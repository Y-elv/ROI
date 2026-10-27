
from pathlib import Path
import pandas as pd
import pyreadstat

root = Path("../backend/data/nisr")

files = {
    "Labour Force Survey CSV":
        root / "labour_force_survey_2025" / "RW_LFS2025.csv",

    "Labour Force Survey DTA":
        root / "labour_force_survey_2025" / "RW_LFS2025.dta",

    "Variable descriptions Excel":
        root / "labour_force_survey_2025" / "Var_descr_RW_LFS2025.xlsx",

    "Establishment Census DTA":
        root / "establishment_census_2023"
        / "data-rwa-nisr-ec-2023v2.dta",
}


def inspect_dataframe(name, df):
    print(f"\n--- {name}: DATA QUALITY ---")
    print("Rows:", len(df))
    print("Columns:", len(df.columns))
    print("Duplicate rows:", df.duplicated().sum())

    print("\nALL COLUMN NAMES:")
    print(df.columns.tolist())

    print("\nDATA TYPES:")
    print(df.dtypes.to_string())

    print("\nMISSING VALUES:")
    missing = df.isna().sum()
    missing = missing[missing > 0].sort_values(ascending=False)
    print(missing.to_string() if not missing.empty else "No missing values")

    print("\nMISSING VALUE PERCENTAGES:")
    if len(df) > 0:
        print((df.isna().mean() * 100).round(2).to_string())

    print("\nSAMPLE RECORDS (first 5):")
    print(df.head().to_string(index=False))


loaded = {}

for name, path in files.items():
    print("\n" + "=" * 90)
    print(name)
    print("Path:", path)
    print("=" * 90)

    if not path.exists():
        print("ERROR: FILE NOT FOUND")
        continue

    try:
        suffix = path.suffix.lower()

        if suffix == ".csv":
            # Full load is needed for total-row and data-quality checks.
            df = pd.read_csv(path)
            loaded["LFS CSV"] = df
            inspect_dataframe(name, df)

        elif suffix == ".dta":
            try:
                df, meta = pyreadstat.read_dta(path)
            except UnicodeDecodeError:
                df, meta = pyreadstat.read_dta(
                    path, encoding="latin1"
                )

            print("Metadata rows:", meta.number_rows)
            print("Metadata columns:", meta.number_columns)

            inspect_dataframe(name, df)

            if "labour_force_survey_2025" in str(path):
                loaded["LFS DTA"] = df

            print("\nSTATA VARIABLE LABELS:")
            labels = getattr(meta, "column_labels", []) or []
            for column, label in zip(meta.column_names, labels):
                print(f"{column}: {label}")

        elif suffix == ".xlsx":
            excel = pd.ExcelFile(path)
            print("Worksheets:", excel.sheet_names)

            for sheet in excel.sheet_names:
                df = pd.read_excel(path, sheet_name=sheet)
                inspect_dataframe(f"{name} / {sheet}", df)

    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}")


# Compare the two LFS representations.
if "LFS CSV" in loaded and "LFS DTA" in loaded:
    csv_df = loaded["LFS CSV"]
    dta_df = loaded["LFS DTA"]

    print("\n" + "=" * 90)
    print("LABOUR FORCE SURVEY CSV VS DTA COMPARISON")
    print("=" * 90)

    print("CSV shape:", csv_df.shape)
    print("DTA shape:", dta_df.shape)

    print("\nColumns only in CSV:")
    print(sorted(set(csv_df.columns) - set(dta_df.columns)))

    print("\nColumns only in DTA:")
    print(sorted(set(dta_df.columns) - set(csv_df.columns)))

    if csv_df.shape == dta_df.shape:
        print("\nSame dimensions; values still need comparison.")
    else:
        print("\nWARNING: CSV and DTA dimensions differ.")

print("\nInspection completed.")
