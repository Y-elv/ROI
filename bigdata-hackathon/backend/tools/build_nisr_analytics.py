from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import pyreadstat


BACKEND_ROOT = Path(__file__).resolve().parents[1]
LFS_PATH = BACKEND_ROOT / "data/nisr/labour_force_survey_2025/RW_LFS2025.dta"
LFS_CODEBOOK_PATH = BACKEND_ROOT / "data/nisr/labour_force_survey_2025/Var_descr_RW_LFS2025.xlsx"
CENSUS_PATH = BACKEND_ROOT / "data/nisr/establishment_census_2023/data-rwa-nisr-ec-2023v2.dta"
DEFAULT_OUTPUT = BACKEND_ROOT / "data/derived/nisr-analytics.json"

WORKFORCE_FIELDS = [
    "Male_worker",
    "Female_worker",
    "Total_workers",
    "Rwandan_male",
    "Rwandan_female",
    "Rwandan_workers",
    "Foreign_male",
    "Foreign_female",
    "Foregner_workers",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def json_number(value: Any) -> int | float | None:
    if pd.isna(value):
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() else number


def value_label_map(metadata: Any, variable: str) -> dict[Any, str]:
    label_set = metadata.variable_to_label.get(variable)
    if not label_set:
        return {}
    return metadata.value_labels.get(label_set, {})


def category_label(value: Any, labels: dict[Any, str]) -> str:
    mapped = labels.get(value)
    if mapped is not None:
        return str(mapped).strip()
    return str(value).strip()


def weighted_rate(
    frame: pd.DataFrame,
    flag: str,
    denominator: str,
    mask: pd.Series | None = None,
) -> dict[str, Any]:
    values = pd.to_numeric(frame[flag], errors="coerce")
    weights = pd.to_numeric(frame["weight2"], errors="coerce")
    valid = values.notna() & weights.notna()
    if mask is not None:
        valid &= mask.fillna(False)
    selected_values = values[valid]
    selected_weights = weights[valid]
    weighted_denominator = float(selected_weights.sum())
    if weighted_denominator <= 0:
        raise ValueError(f"No positive weighted denominator for {flag}")
    if not selected_values.isin([0, 100]).all():
        raise ValueError(f"Unexpected values in binary indicator {flag}")
    numerator = float((selected_weights * selected_values / 100).sum())
    return {
        "value": round(numerator / weighted_denominator * 100, 4),
        "unit": "percent",
        "numeratorWeighted": round(numerator, 3),
        "denominatorWeighted": round(weighted_denominator, 3),
        "numeratorUnweighted": int(selected_values.eq(100).sum()),
        "denominatorUnweighted": int(valid.sum()),
        "denominator": denominator,
        "weight": "weight2 (NISR annual weight)",
    }


def weighted_count(
    frame: pd.DataFrame,
    weight: str,
    mask: pd.Series | None = None,
) -> dict[str, Any]:
    weights = pd.to_numeric(frame[weight], errors="coerce")
    valid = weights.notna()
    if mask is not None:
        valid &= mask.fillna(False)
    return {
        "estimate": round(float(weights[valid].sum()), 3),
        "unweightedRecords": int(valid.sum()),
        "weight": "weight2 (NISR annual weight)",
    }


def weighted_status_rate(
    frame: pd.DataFrame,
    numerator_mask: pd.Series,
    denominator_mask: pd.Series,
    denominator: str,
) -> dict[str, Any]:
    weights = pd.to_numeric(frame["weight2"], errors="coerce")
    valid = weights.notna() & denominator_mask.fillna(False)
    numerator = valid & numerator_mask.fillna(False)
    weighted_denominator = float(weights[valid].sum())
    if weighted_denominator <= 0:
        raise ValueError("No positive weighted denominator for status rate")
    weighted_numerator = float(weights[numerator].sum())
    return {
        "value": round(weighted_numerator / weighted_denominator * 100, 4),
        "unit": "percent",
        "numeratorWeighted": round(weighted_numerator, 3),
        "denominatorWeighted": round(weighted_denominator, 3),
        "numeratorUnweighted": int(numerator.sum()),
        "denominatorUnweighted": int(valid.sum()),
        "denominator": denominator,
        "weight": "weight2 (NISR annual weight)",
    }


def status_metrics(frame: pd.DataFrame) -> dict[str, Any]:
    age = pd.to_numeric(frame["A04"], errors="coerce")
    status = pd.to_numeric(frame["status1"], errors="coerce")
    working_age = age.ge(16) & status.notna()
    labor_force = working_age & status.isin([1, 2])
    youth_population = age.between(16, 24) & status.notna()
    youth_labor_force = youth_population & status.isin([1, 2])
    return {
        "employmentToPopulationRatio": weighted_status_rate(
            frame, status.eq(1), working_age, "Population age 16 and older with valid labour-force status"
        ),
        "labourForceParticipationRate": weighted_status_rate(
            frame, status.isin([1, 2]), working_age, "Population age 16 and older with valid labour-force status"
        ),
        "unemploymentRate": weighted_status_rate(
            frame, status.eq(2), labor_force, "Labour force age 16 and older"
        ),
        "youthEmploymentToPopulationRatio": weighted_status_rate(
            frame, status.eq(1), youth_population, "Youth population age 16-24 with valid labour-force status"
        ),
        "youthUnemploymentRate": weighted_status_rate(
            frame, status.eq(2), youth_labor_force, "Youth labour force age 16-24"
        ),
    }


def weighted_distribution(
    frame: pd.DataFrame,
    variable: str,
    metadata: Any,
    mask: pd.Series | None = None,
) -> dict[str, Any]:
    values = frame[variable]
    weights = pd.to_numeric(frame["weight2"], errors="coerce")
    valid = values.notna() & weights.notna()
    if mask is not None:
        valid &= mask.fillna(False)
    denominator = float(weights[valid].sum())
    labels = value_label_map(metadata, variable)
    categories = []
    for code, group in frame.loc[valid].groupby(variable, dropna=True, sort=False):
        selected_weight = float(weights.loc[group.index].sum())
        categories.append({
            "code": json_number(code),
            "label": category_label(code, labels),
            "weightedEstimate": round(selected_weight, 3),
            "sharePercent": round(selected_weight / denominator * 100, 4) if denominator else None,
            "unweightedRecords": int(len(group)),
        })
    categories.sort(key=lambda item: item["weightedEstimate"], reverse=True)
    return {
        "variable": variable,
        "variableLabel": metadata.column_labels[metadata.column_names.index(variable)],
        "validWeightedDenominator": round(denominator, 3),
        "validUnweightedRecords": int(valid.sum()),
        "missingUnweightedRecords": int((~valid).sum()),
        "weight": "weight2 (NISR annual weight)",
        "categories": categories,
    }


def weighted_breakdown(
    frame: pd.DataFrame,
    variable: str,
    metadata: Any,
    mask: pd.Series | None = None,
) -> list[dict[str, Any]]:
    valid_group = frame[variable].notna()
    if mask is not None:
        valid_group &= mask.fillna(False)
    labels = value_label_map(metadata, variable)
    result = []
    for code, group in frame.loc[valid_group].groupby(variable, dropna=True, sort=False):
        item: dict[str, Any] = {
            "code": json_number(code),
            "label": category_label(code, labels),
            "metrics": status_metrics(group),
        }
        item["unweightedRecords"] = int(len(group))
        result.append(item)
    result.sort(key=lambda item: item["label"])
    return result


def validate_lfs(frame: pd.DataFrame, metadata: Any, codebook: pd.DataFrame) -> None:
    required = {
        "LFS_year", "weight2", "PSU_NO", "lfs_strata", "A04", "status1", "wap16",
        "employed16", "LFPR", "UR1", "youth", "YUR1", "province", "code_dis",
        "Code_UR", "attained", "indb05", "B07", "B08", "B10", "isco2digit",
        "isic2digitdigit",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"LFS file is missing required variables: {sorted(missing)}")
    if set(frame["LFS_year"].dropna().unique()) != {2025}:
        raise ValueError("LFS_year must contain only 2025")
    if frame["weight2"].isna().any() or (frame["weight2"] <= 0).any():
        raise ValueError("weight2 must be present and positive for all LFS records")
    codebook_names = set(codebook["name"].dropna().astype(str))
    if not required.issubset(codebook_names):
        raise ValueError("LFS codebook is missing one or more required variable entries")

    age = pd.to_numeric(frame["A04"], errors="coerce")
    status = pd.to_numeric(frame["status1"], errors="coerce")
    expected_status_universe = age.ge(14)
    if not frame["status1"].notna().equals(expected_status_universe):
        raise ValueError("status1 nonmissing records do not match the labeled 14+ universe")
    expected_working_age = age.ge(16)
    for variable in ["wap16", "employed16", "LFPR"]:
        if not frame[variable].notna().equals(expected_working_age):
            raise ValueError(f"{variable} nonmissing records do not match the verified age-16+ universe")
    expected_labour_force = expected_working_age & status.isin([1, 2])
    if not frame["UR1"].notna().equals(expected_labour_force):
        raise ValueError("UR1 nonmissing records do not match the verified age-16+ labour-force universe")
    if not frame["youth"].eq(1).fillna(False).equals(age.between(16, 24)):
        raise ValueError("youth flag does not match the labeled 16-24 age range")
    if not frame["young"].eq(1).fillna(False).equals(age.between(16, 30)):
        raise ValueError("young flag does not match the labeled 16-30 age range")

    expected = {
        "employed16": status.eq(1).astype(float) * 100,
        "LFPR": status.isin([1, 2]).astype(float) * 100,
        "UR1": status.eq(2).astype(float) * 100,
    }
    for variable, expected_values in expected.items():
        valid = frame[variable].notna()
        actual_values = pd.to_numeric(frame.loc[valid, variable]).astype(float)
        if not actual_values.equals(expected_values.loc[valid].astype(float)):
            raise ValueError(f"{variable} values disagree with status1 coding")
    valid_youth_unemployment = frame["YUR1"].notna()
    expected_youth_unemployment = status.eq(2).astype(float) * 100
    if not age.loc[valid_youth_unemployment].between(16, 30).all():
        raise ValueError("YUR1 nonmissing universe is not limited to the labeled young age range")
    expected_young_labour_force = age.between(16, 30) & status.isin([1, 2])
    if not frame["YUR1"].notna().equals(expected_young_labour_force):
        raise ValueError("YUR1 nonmissing records do not match the verified age-16-30 labour-force universe")
    for variable in ["isco2digit", "isic2digitdigit"]:
        if not frame[variable].notna().equals(status.eq(1)):
            raise ValueError(f"{variable} nonmissing records do not match employed status")
    if not pd.to_numeric(frame.loc[valid_youth_unemployment, "YUR1"]).astype(float).equals(
        expected_youth_unemployment.loc[valid_youth_unemployment].astype(float)
    ):
        raise ValueError("YUR1 values disagree with status1 coding")

    for variable in ["employed16", "LFPR", "UR1", "YUR1"]:
        values = pd.to_numeric(frame[variable].dropna())
        if not values.isin([0, 100]).all():
            raise ValueError(f"{variable} must contain only 0/100 indicator values")
    for variable in ["status1", "B07", "B08"]:
        if not value_label_map(metadata, variable):
            raise ValueError(f"{variable} is missing its Stata value-label mapping")


def read_census(path: Path) -> tuple[pd.DataFrame, Any]:
    try:
        return pyreadstat.read_dta(str(path))
    except UnicodeDecodeError:
        return pyreadstat.read_dta(str(path), encoding="latin1")


def validate_census(frame: pd.DataFrame) -> None:
    required = {
        "q1_1", "q1_2", "q7", "q17_2", "q17_3", "Male_worker", "Female_worker",
        "Total_workers", "Rwandan_male", "Rwandan_female", "Rwandan_workers",
        "Foreign_male", "Foreign_female", "Foregner_workers", "size2", "FI",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Census file is missing required variables: {sorted(missing)}")
    if (frame[WORKFORCE_FIELDS] < 0).any().any():
        raise ValueError("Census workforce counts cannot be negative")
    if not (frame["Male_worker"] + frame["Female_worker"]).equals(frame["Total_workers"]):
        raise ValueError("Census total workforce does not match male plus female counts")
    if not (frame["Rwandan_workers"] + frame["Foregner_workers"]).equals(frame["Total_workers"]):
        raise ValueError("Census total workforce does not match Rwandan plus foreign worker counts")


def census_breakdown(
    frame: pd.DataFrame,
    variable: str,
    metadata: Any,
) -> list[dict[str, Any]]:
    labels = value_label_map(metadata, variable)
    rows = []
    for code, group in frame.groupby(variable, dropna=True, sort=False):
        rows.append({
            "code": json_number(code),
            "label": category_label(code, labels),
            "establishmentRecords": int(len(group)),
            "workforce": {
                field: int(group[field].sum())
                for field in ["Male_worker", "Female_worker", "Total_workers", "Rwandan_workers", "Foregner_workers"]
            },
        })
    rows.sort(key=lambda item: item["label"])
    return rows


def build_document() -> dict[str, Any]:
    for source in [LFS_PATH, LFS_CODEBOOK_PATH, CENSUS_PATH]:
        if not source.is_file():
            raise FileNotFoundError(f"Required NISR source file not found: {source}")

    lfs, lfs_metadata = pyreadstat.read_dta(str(LFS_PATH))
    codebook = pd.read_excel(LFS_CODEBOOK_PATH)
    validate_lfs(lfs, lfs_metadata, codebook)

    census, census_metadata = read_census(CENSUS_PATH)
    validate_census(census)

    working_age = pd.to_numeric(lfs["wap16"], errors="coerce").eq(1)
    status = pd.to_numeric(lfs["status1"], errors="coerce")
    employed = status.eq(1)

    status_distribution = weighted_distribution(lfs, "status1", lfs_metadata)
    metrics = {
        "workingAgePopulation": {
            **weighted_count(lfs, "weight2", working_age),
            "denominator": "Population age 16 and older",
            "sourceVariable": "wap16",
        },
        **status_metrics(lfs),
        "labourForceStatusAge14Plus": status_distribution,
    }

    labour_dimensions = {
        "province": "province",
        "district": "code_dis",
        "residence": "Code_UR",
    }
    labour_market = {
        "overview": metrics,
        "dimensions": {
            key: weighted_breakdown(lfs, variable, lfs_metadata)
            for key, variable in labour_dimensions.items()
        },
        "employmentBySector": weighted_distribution(
            lfs, "isic2digitdigit", lfs_metadata, employed
        ),
        "employmentByOccupation": weighted_distribution(
            lfs, "isco2digit", lfs_metadata, employed
        ),
    }

    education_fields = {
        "highestEducationAttended": "B02A",
        "educationCompleted": "attained",
        "fieldOfEducation": "indb05",
        "currentlyAttendingTVET": "B07",
        "everLearnedTVET": "B08",
        "technicalSkillLearned": "B10",
    }
    education = {
        "distributions": {
            key: weighted_distribution(lfs, variable, lfs_metadata)
            for key, variable in education_fields.items()
        },
        "limitations": [
            "Each distribution uses only records with a nonmissing response for that variable.",
            "The LFS labels B02A as highest education attended and attained as level completed; they are not interchangeable.",
            "TVET indicators describe survey responses and do not certify a qualification or occupational competency.",
        ],
    }

    census_groups = {
        "province": "q1_1",
        "district": "q1_2",
        "sector": "q7",
        "formality": "FI",
        "size": "size2",
    }
    census_summary = {
        "sourceYear": 2023,
        "establishmentRecords": int(len(census)),
        "exactDuplicateRowsRetained": int(census.duplicated().sum()),
        "workforceTotals": {field: int(census[field].sum()) for field in WORKFORCE_FIELDS},
        "dimensions": {
            key: census_breakdown(census, variable, census_metadata)
            for key, variable in census_groups.items()
        },
        "limitations": [
            "The supplied file has no verified unique establishment identifier; row counts are records, not confirmed unique establishments.",
            "Exact repeated rows are retained; workforce totals may include repeated records.",
            "Census figures are unweighted sums over supplied records; no census expansion weight was identified.",
            "The workforce fields are internally consistent by recorded gender and nationality, but this does not resolve record duplication.",
        ],
    }

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "labourForceSurvey": {
                "name": "Rwanda Labour Force Survey 2025",
                "sourceYear": 2025,
                "dataFile": str(LFS_PATH.relative_to(BACKEND_ROOT)).replace("\\", "/"),
                "dataSha256": sha256_file(LFS_PATH),
                "codebookFile": str(LFS_CODEBOOK_PATH.relative_to(BACKEND_ROOT)).replace("\\", "/"),
                "codebookSha256": sha256_file(LFS_CODEBOOK_PATH),
                "records": int(len(lfs)),
                "weightVariable": "weight2",
                "weightLabel": "Annual weight",
            },
            "establishmentCensus": {
                "name": "Rwanda Establishment Census 2023",
                "sourceYear": 2023,
                "dataFile": str(CENSUS_PATH.relative_to(BACKEND_ROOT)).replace("\\", "/"),
                "dataSha256": sha256_file(CENSUS_PATH),
                "records": int(len(census)),
            },
        },
        "methodology": {
            "lfs": [
                "The Stata file is used because its value labels preserve valid categories that are missing in the CSV export, including 'None' education responses.",
                "Rate estimates are derived from the value-labeled status1 categories and age A04 using weight2, labeled Annual weight. Employed is status1=1; unemployed is status1=2; labour force is those two categories.",
                "The working-age indicators were verified against age 16+; youth flags were verified against ages 16-24, and young flags against ages 16-30.",
                "The NISR-provided 0/100 indicators are cross-checked against age and status. Rate numerators and denominators are recomputed from status1 so the target age universe is explicit; missing indicator flags below their labeled age universes are structural.",
                "For comparable 16-24 youth indicators, employment and unemployment rates are computed from status1 and age. NISR's YUR1 nonmissing records instead span the labeled 16-30 'young' group and are not used for the 16-24 rate.",
                "Rates use only records with valid status1 for the stated age denominator; no missing value is imputed.",
                "PSU_NO and lfs_strata are present, but design-based standard errors and confidence intervals are not calculated.",
                "No missing response is changed to zero; distribution denominators include only nonmissing responses.",
            ],
            "establishmentCensus": [
                "Workforce measures are sums of the supplied 2023 census fields; no survey weight is applied.",
                "Exact duplicate rows are retained because no verified unique record key or duplication rule is available.",
            ],
        },
        "labourMarket": labour_market,
        "education": education,
        "establishments": census_summary,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build cached NISR analytics from local source files.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    document = build_document()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary_path.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(temporary_path, args.output)
    print(f"Generated {args.output} ({args.output.stat().st_size} bytes)")
    print(f"LFS records: {document['sources']['labourForceSurvey']['records']}")
    print(f"Census records: {document['sources']['establishmentCensus']['records']}")
    print(f"LFS indicators: {', '.join(document['labourMarket']['overview'].keys())}")
    print(f"Retained exact census duplicate rows: {document['establishments']['exactDuplicateRowsRetained']}")


if __name__ == "__main__":
    main()