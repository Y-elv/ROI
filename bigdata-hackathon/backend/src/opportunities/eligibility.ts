import {
  DisclosureState,
  EligibilityResult,
  EvidenceReference,
  Opportunity,
  OpportunityRequirement,
  ProfileFactValue,
  ProfileSkill,
  RequirementCriterion,
  RequirementEvaluation,
  RequirementEvaluationStatus,
  UserProfile,
  OpportunityValidationResult,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_STATUSES,
  DEADLINE_STATUSES,
  VERIFICATION_STATES,
  ProficiencyLevel,
  OpportunityProvenance,
} from "./types";

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const EVIDENCE_KINDS = [
  "self_reported", "self_taught", "document", "project", "portfolio", "work", "assessment", "source_listing", "other",
];
const RWANDA_DISTRICTS = new Set([
  "Bugesera", "Burera", "Gakenke", "Gasabo", "Gatsibo", "Gicumbi", "Gisagara", "Huye",
  "Kamonyi", "Karongi", "Kayonza", "Kicukiro", "Kirehe", "Muhanga", "Musanze",
  "Ngoma", "Ngororero", "Nyabihu", "Nyagatare", "Nyamagabe", "Nyamasheke",
  "Nyanza", "Nyarugenge", "Nyaruguru", "Rubavu", "Ruhango", "Rulindo", "Rusizi",
  "Rutsiro", "Rwamagana",
]);

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDisclosure(value: unknown): value is DisclosureState {
  return value === "complete" || value === "partial" || value === "unknown";
}

function isProficiency(value: unknown): value is ProficiencyLevel {
  return value === "beginner" || value === "intermediate" || value === "advanced" || value === "expert";
}

function isEvidenceArray(value: unknown): value is EvidenceReference[] {
  return value === undefined || (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry) && EVIDENCE_KINDS.includes(String(entry.kind)) && isNonEmptyString(entry.description))
  );
}

function evaluateFact(status: RequirementEvaluationStatus, explanation: string): {
  status: RequirementEvaluationStatus;
  explanation: string;
} {
  return { status, explanation };
}

function countryValues(profile: UserProfile, basis: "residence" | "citizenship" | "work_authorization"): string[] | undefined {
  if (basis === "residence") {
    return profile.residenceCountryCode ? [profile.residenceCountryCode] : undefined;
  }
  if (basis === "citizenship") return profile.citizenshipCountryCodes;
  return profile.workAuthorizationCountryCodes;
}

function evaluateCriterion(
  profile: UserProfile,
  criterion: RequirementCriterion,
): { status: RequirementEvaluationStatus; explanation: string } {
  switch (criterion.kind) {
    case "minimum_age":
      if (profile.age === undefined) return evaluateFact("unresolved", "Age was not provided.");
      return profile.age >= criterion.years
        ? evaluateFact("satisfied", `Reported age meets the minimum age of ${criterion.years}.`)
        : evaluateFact("unmet", `Reported age is below the minimum age of ${criterion.years}.`);

    case "maximum_age":
      if (profile.age === undefined) return evaluateFact("unresolved", "Age was not provided.");
      return profile.age <= criterion.years
        ? evaluateFact("satisfied", `Reported age is within the maximum age of ${criterion.years}.`)
        : evaluateFact("unmet", `Reported age exceeds the maximum age of ${criterion.years}.`);

    case "country_eligibility": {
      const countries = countryValues(profile, criterion.basis);
      if (!countries || countries.length === 0) {
        return evaluateFact("unresolved", `Profile does not state ${criterion.basis.replaceAll("_", " ")} country information.`);
      }
      const allowed = new Set(criterion.allowedCountryCodes.map(normalize));
      const match = countries.some((country) => allowed.has(normalize(country)));
      return match
        ? evaluateFact("satisfied", `A stated ${criterion.basis.replaceAll("_", " ")} country is allowed.`)
        : evaluateFact("unmet", `No stated ${criterion.basis.replaceAll("_", " ")} country matches the documented allowed countries.`);
    }

    case "education": {
      const qualifications = profile.qualifications ?? [];
      const acceptedLevels = new Set(criterion.acceptedLevels.map(normalize));
      const levelMatches = qualifications.filter(
        (qualification) => qualification.level && acceptedLevels.has(normalize(qualification.level)),
      );
      if (levelMatches.length === 0) {
        return profile.qualificationDisclosure === "complete"
          ? evaluateFact("unmet", "The complete qualification history contains no documented accepted education level.")
          : evaluateFact("unresolved", "Qualification information is missing or incomplete.");
      }
      if (!criterion.acceptedFieldsOfStudy || criterion.acceptedFieldsOfStudy.length === 0) {
        return evaluateFact("satisfied", "A qualification has an explicitly accepted level; no equivalency was inferred.");
      }
      const acceptedFields = new Set(criterion.acceptedFieldsOfStudy.map(normalize));
      if (levelMatches.some((qualification) => qualification.fieldOfStudy && acceptedFields.has(normalize(qualification.fieldOfStudy)))) {
        return evaluateFact("satisfied", "A qualification matches an explicitly accepted field of study.");
      }
      if (levelMatches.some((qualification) => !qualification.fieldOfStudy)) {
        return evaluateFact("unresolved", "The qualifying education level is stated, but its field of study is missing.");
      }
      return profile.qualificationDisclosure === "complete"
        ? evaluateFact("unmet", "Documented fields of study do not match the accepted fields.")
        : evaluateFact("unresolved", "The qualification history is incomplete, so field-of-study fit is unresolved.");
    }

    case "skill": {
      const skill = (profile.skills ?? []).find((entry) => normalize(entry.name) === normalize(criterion.name));
      if (!skill) {
        return profile.skillDisclosure === "complete"
          ? evaluateFact("unmet", `The complete skills profile does not list ${criterion.name}.`)
          : evaluateFact("unresolved", `${criterion.name} is not listed; missing profile information is not treated as a failure.`);
      }
      if (!criterion.minimumProficiency) {
        return evaluateFact("satisfied", `${criterion.name} is listed in the profile.`);
      }
      if (!skill.proficiency) return evaluateFact("unresolved", `Proficiency in ${criterion.name} was not provided.`);
      return PROFICIENCY_RANK[skill.proficiency] >= PROFICIENCY_RANK[criterion.minimumProficiency]
        ? evaluateFact("satisfied", `Stated ${criterion.name} proficiency meets the documented minimum.`)
        : evaluateFact("unmet", `Stated ${criterion.name} proficiency is below the documented minimum.`);
    }

    case "minimum_experience": {
      const experiences = profile.workExperience ?? [];
      if (profile.workExperienceDisclosure !== "complete") {
        return evaluateFact("unresolved", "Work-history completeness is not confirmed.");
      }
      if (criterion.relatedArea && experiences.some((experience) => !experience.areas)) {
        return evaluateFact("unresolved", "The work history is complete, but some roles do not identify their areas, so related experience cannot be confirmed.");
      }
      const relevant = criterion.relatedArea
        ? experiences.filter((experience) => (experience.areas ?? []).some((area) => normalize(area) === normalize(criterion.relatedArea!)))
        : experiences;
      const years = relevant.reduce((total, experience) => total + experience.years, 0);
      return years >= criterion.years
        ? evaluateFact("satisfied", `Complete stated work history documents ${years} relevant year(s).`)
        : evaluateFact("unmet", `Complete stated work history documents ${years} year(s), below the required ${criterion.years}.`);
    }

    case "certification": {
      const match = (profile.certifications ?? []).some(
        (certification) => normalize(certification.name) === normalize(criterion.name),
      );
      if (match) return evaluateFact("satisfied", `The documented certification ${criterion.name} is present.`);
      return profile.certificationDisclosure === "complete"
        ? evaluateFact("unmet", `The complete certification list does not include ${criterion.name}.`)
        : evaluateFact("unresolved", `The profile does not establish whether ${criterion.name} is held.`);
    }

    case "profile_fact": {
      const fact = profile.facts?.[criterion.key];
      if (!fact || fact.certainty === "unknown") {
        return evaluateFact("unresolved", `The profile fact '${criterion.key}' is unknown or missing.`);
      }
      return equalFactValues(fact.value, criterion.expectedValue)
        ? evaluateFact("satisfied", `The stated profile fact '${criterion.key}' matches the documented requirement.`)
        : evaluateFact("unmet", `The stated profile fact '${criterion.key}' does not match the documented requirement.`);
    }
  }
}

function equalFactValues(left: ProfileFactValue, right: ProfileFactValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length && left.every((value, index) => normalize(value) === normalize(right[index]));
  }
  if (typeof left === "string" && typeof right === "string") return normalize(left) === normalize(right);
  return left === right;
}

function evaluateRequirement(
  profile: UserProfile,
  requirement: OpportunityRequirement,
): RequirementEvaluation {
  if (requirement.certainty !== "known") {
    return {
      requirementId: requirement.id,
      description: requirement.description,
      importance: requirement.importance,
      status: "unresolved",
      explanation: requirement.certainty === "unknown"
        ? "The source marks this requirement as unknown."
        : "The source does not state whether this requirement applies.",
      sourceEvidence: requirement.evidence,
      profileEvidence: [],
      actionToResolve: "Confirm whether this criterion applies with the listed opportunity source.",
    };
  }
  const result = evaluateCriterion(profile, requirement.criterion);
  const profileEvidence = criterionProfileEvidence(profile, requirement.criterion);
  return {
    requirementId: requirement.id,
    description: requirement.description,
    importance: requirement.importance,
    ...result,
    sourceEvidence: requirement.evidence,
    profileEvidence,
    ...(result.status === "unresolved" || result.status === "unmet"
      ? { actionToResolve: actionForCriterion(requirement.criterion, result.status) }
      : {}),
  };
}

function criterionProfileEvidence(profile: UserProfile, criterion: RequirementCriterion): string[] {
  switch (criterion.kind) {
    case "minimum_age":
    case "maximum_age":
      return profile.age === undefined ? [] : [`Reported age: ${profile.age}`];
    case "country_eligibility":
      return countryValues(profile, criterion.basis) ?? [];
    case "education":
      return (profile.qualifications ?? []).map((qualification) =>
        [qualification.level, qualification.fieldOfStudy, qualification.name].filter(Boolean).join(" — "));
    case "skill":
      return (profile.skills ?? []).filter((skill) => normalize(skill.name) === normalize(criterion.name))
        .map((skill) => `${skill.name}${skill.proficiency ? ` (${skill.proficiency})` : ""}`);
    case "minimum_experience":
      return (profile.workExperience ?? []).map((experience) =>
        `${experience.role}: ${experience.years} year(s)${experience.areas?.length ? ` in ${experience.areas.join(", ")}` : ""}`);
    case "certification":
      return (profile.certifications ?? []).map((certification) => certification.name);
    case "profile_fact": {
      const fact = profile.facts?.[criterion.key];
      return fact?.certainty === "known" ? [`${criterion.key}: ${String(fact.value)}`] : [];
    }
  }
}

function actionForCriterion(
  criterion: RequirementCriterion,
  status: RequirementEvaluationStatus,
): string {
  const action = status === "unmet" ? "Address or verify" : "Provide or confirm";
  switch (criterion.kind) {
    case "education": return `${action} the accepted qualification and field of study.`;
    case "skill": return `${action} skill: ${criterion.name}.`;
    case "minimum_experience": return `${action} relevant experience and duration.`;
    case "certification": return `${action} certification: ${criterion.name}.`;
    case "minimum_age":
    case "maximum_age": return `${action} the age criterion with the opportunity source.`;
    case "country_eligibility": return `${action} the required country or work-authorization information.`;
    case "profile_fact": return `${action} the profile information required for this criterion.`;
  }
}

export function evaluateEligibility(profile: UserProfile, opportunity: Opportunity): EligibilityResult {
  const evaluations = opportunity.requirements.map((requirement, index) => {
    if (typeof requirement !== "string") return evaluateRequirement(profile, requirement);
    return {
      requirementId: `source-requirement-${index + 1}`,
      description: requirement,
      importance: "unknown" as const,
      status: "unresolved" as const,
      explanation: "The catalogue provides this requirement as prose without structured eligibility criteria.",
      sourceEvidence: [],
      profileEvidence: [],
      actionToResolve: "Check the full listing or ask the source which criteria apply.",
    };
  });
  if (opportunity.metadata?.isSynthetic === true) {
    const unresolved = evaluations.map((evaluation) => ({
      ...evaluation,
      status: "unresolved" as const,
      explanation: "This is synthetic demo data; its requirements cannot establish real-world eligibility.",
    }));
    return {
      outcome: "unknown",
      explanation: "This synthetic, non-live fixture cannot establish eligibility for any real opportunity.",
      satisfied: [],
      unmet: [],
      unresolved: [{
        requirementId: "synthetic-fixture",
        description: "Real-world opportunity and eligibility have not been verified",
        importance: "unknown",
        status: "unresolved",
        explanation: "The record is a synthetic local fixture, not a genuine vacancy or programme.",
      }, ...unresolved],
      preferred: [],
    };
  }
  const mandatory = evaluations.filter((evaluation) => evaluation.importance === "mandatory");
  const preferred = evaluations.filter((evaluation) => evaluation.importance === "preferred");
  const unclassified = evaluations.filter((evaluation) => evaluation.importance === "unknown");
  const satisfied = mandatory.filter((evaluation) => evaluation.status === "satisfied");
  const unmet = mandatory.filter((evaluation) => evaluation.status === "unmet");
  const unresolved = [
    ...mandatory.filter((evaluation) => evaluation.status === "unresolved"),
    ...unclassified,
  ];

  if (unclassified.length > 0 || opportunity.mandatoryRequirementsDisclosure !== "complete") {
    unresolved.push({
      requirementId: "mandatory-requirements-disclosure",
      description: "Completeness of the opportunity's mandatory requirements",
      importance: "unknown",
      status: "unresolved",
      explanation: "The catalogue does not classify requirement importance or confirm that all mandatory requirements are disclosed.",
    });
  }

  const outcome = unmet.length > 0
    ? "ineligible"
    : unresolved.length > 0
      ? "unknown"
      : "eligible";
  const explanation = outcome === "ineligible"
    ? "At least one documented mandatory requirement is demonstrably unmet."
    : outcome === "unknown"
      ? "No mandatory requirement is known to be unmet, but required information remains unresolved."
      : "All disclosed mandatory requirements are satisfied; this is not a guarantee of selection.";

  return { outcome, explanation, satisfied, unmet, unresolved, preferred };
}

function isCountryCodeList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function validCriterion(value: unknown): value is RequirementCriterion {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return false;
  switch (value.kind) {
    case "minimum_age":
    case "maximum_age":
    case "minimum_experience":
      return typeof value.years === "number" && Number.isFinite(value.years) && value.years >= 0 &&
        (value.kind !== "minimum_experience" || value.relatedArea === undefined || isNonEmptyString(value.relatedArea));
    case "country_eligibility":
      return ["residence", "citizenship", "work_authorization"].includes(String(value.basis)) &&
        isCountryCodeList(value.allowedCountryCodes) && value.allowedCountryCodes.length > 0;
    case "education":
      return isCountryCodeList(value.acceptedLevels) && value.acceptedLevels.length > 0 &&
        (value.acceptedFieldsOfStudy === undefined || isCountryCodeList(value.acceptedFieldsOfStudy));
    case "skill":
      return isNonEmptyString(value.name) &&
        (value.minimumProficiency === undefined || isProficiency(value.minimumProficiency));
    case "certification":
      return isNonEmptyString(value.name);
    case "profile_fact":
      return isNonEmptyString(value.key) &&
        (typeof value.expectedValue === "string" || typeof value.expectedValue === "number" ||
          typeof value.expectedValue === "boolean" || isCountryCodeList(value.expectedValue));
    default:
      return false;
  }
}

function validDate(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validRequirement(value: unknown, index: number, errors: string[]): boolean {
  if (!isRecord(value)) {
    errors.push(`requirements[${index}] must be an object.`);
    return false;
  }
  let valid = true;
  if (!isNonEmptyString(value.id)) {
    errors.push(`requirements[${index}].id is required.`);
    valid = false;
  }
  if (!isNonEmptyString(value.description)) {
    errors.push(`requirements[${index}].description is required.`);
    valid = false;
  }
  if (value.importance !== "mandatory" && value.importance !== "preferred" && value.importance !== "unknown") {
    errors.push(`requirements[${index}].importance must be mandatory, preferred, or unknown.`);
    valid = false;
  }
  if (value.certainty !== "known" && value.certainty !== "unknown" && value.certainty !== "not_stated") {
    errors.push(`requirements[${index}].certainty is invalid.`);
    valid = false;
  } else if (value.certainty === "known" && !validCriterion(value.criterion)) {
    errors.push(`requirements[${index}].criterion is missing or invalid for a known requirement.`);
    valid = false;
  } else if (value.certainty === "known" && (!Array.isArray(value.evidence) || value.evidence.length === 0)) {
    errors.push(`requirements[${index}].evidence is required for a known requirement.`);
    valid = false;
  } else if (value.certainty !== "known" && value.criterion !== undefined) {
    errors.push(`requirements[${index}].criterion must be omitted when certainty is not known.`);
    valid = false;
  }
  if (!isEvidenceArray(value.evidence)) {
    errors.push(`requirements[${index}].evidence is invalid.`);
    valid = false;
  }
  return valid;
}

function validSuitabilitySignals(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const skills = value.skills;
  const interests = value.interests;
  return (skills === undefined || (Array.isArray(skills) && skills.every((skill) =>
    isRecord(skill) && isNonEmptyString(skill.name) &&
    (skill.minimumProficiency === undefined || isProficiency(skill.minimumProficiency)) &&
    (skill.purpose === undefined || ["required", "preferred", "learning_outcome", "related"].includes(String(skill.purpose))) &&
    Array.isArray(skill.evidence) && skill.evidence.length > 0 && isEvidenceArray(skill.evidence)))) &&
    (interests === undefined || (Array.isArray(interests) && interests.every((interest) =>
      isRecord(interest) && isNonEmptyString(interest.value) &&
      Array.isArray(interest.evidence) && interest.evidence.length > 0 && isEvidenceArray(interest.evidence))));
}

function validCareerFamilies(value: unknown): boolean {
  return Array.isArray(value) && value.every((signal) =>
    isRecord(signal) &&
    isNonEmptyString(signal.family) &&
    Array.isArray(signal.terms) && signal.terms.length > 0 && signal.terms.every(isNonEmptyString) &&
    (signal.confidence === "source_stated" || signal.confidence === "taxonomy_inferred") &&
    Array.isArray(signal.evidence) && signal.evidence.length > 0 && isEvidenceArray(signal.evidence));
}

function validProvenance(value: unknown): value is OpportunityProvenance[] {
  return Array.isArray(value) && value.every((entry) =>
    isRecord(entry) &&
    isNonEmptyString(entry.field) &&
    isNonEmptyString(entry.sourceId) &&
    ["known", "source_stated", "taxonomy_inferred", "unknown"].includes(String(entry.certainty)) &&
    Array.isArray(entry.evidence) && entry.evidence.length > 0 && isEvidenceArray(entry.evidence));
}

export function validateOpportunity(input: unknown): OpportunityValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["Opportunity must be an object."] };

  if (!isNonEmptyString(input.id)) errors.push("id is required.");
  if (!OPPORTUNITY_TYPES.includes(input.type as (typeof OPPORTUNITY_TYPES)[number])) errors.push("type is not a supported catalogue value.");
  if (!isNonEmptyString(input.title)) errors.push("title is required.");
  if (!isRecord(input.organization) || !isNonEmptyString(input.organization.name)) {
    errors.push("organization.name is required.");
  }
  if (!isRecord(input.source) || !isNonEmptyString(input.source.id) || !isNonEmptyString(input.source.name)) {
    errors.push("source.id and source.name are required.");
  }
  if (input.applicationUrl !== undefined && input.applicationUrl !== null) {
    if (!isNonEmptyString(input.applicationUrl)) {
      errors.push("applicationUrl must be a non-empty URL or null.");
    } else {
      try {
        const protocol = new URL(input.applicationUrl).protocol;
        if (protocol !== "https:" && protocol !== "http:") errors.push("applicationUrl must use HTTP or HTTPS.");
      } catch {
        errors.push("applicationUrl must be an absolute HTTP or HTTPS URL.");
      }
    }
  }
  if (!Array.isArray(input.requirements) || !input.requirements.every((requirement, index) =>
    typeof requirement === "string"
      ? isNonEmptyString(requirement)
      : validRequirement(requirement, index, errors))) {
    errors.push("requirements must be an array of non-empty strings or valid structured requirements.");
  }
  if (!OPPORTUNITY_STATUSES.includes(input.status as (typeof OPPORTUNITY_STATUSES)[number])) {
    errors.push("status is not a supported catalogue value.");
  }
  if (!DEADLINE_STATUSES.includes(input.deadlineStatus as (typeof DEADLINE_STATUSES)[number])) {
    errors.push("deadlineStatus is not a supported catalogue value.");
  }
  if (!isRecord(input.costAndFunding)) {
    errors.push("costAndFunding must be an object.");
  } else {
    if (input.costAndFunding.cost !== undefined && input.costAndFunding.cost !== null &&
      typeof input.costAndFunding.cost !== "string" && typeof input.costAndFunding.cost !== "number" &&
      !isRecord(input.costAndFunding.cost)) {
      errors.push("costAndFunding.cost has an unsupported value.");
    }
    if (input.costAndFunding.benefits !== undefined && input.costAndFunding.benefits !== null &&
      (!Array.isArray(input.costAndFunding.benefits) || !input.costAndFunding.benefits.every(isNonEmptyString))) {
      errors.push("costAndFunding.benefits must be an array of non-empty strings or null.");
    }
  }
  if (input.location !== undefined && input.location !== null) {
    if (!isRecord(input.location)) {
      errors.push("location must be an object or null.");
    } else {
      for (const field of ["country", "province", "district", "displayLocation", "workMode"]) {
        const value = input.location[field];
        if (value !== undefined && value !== null && typeof value !== "string") {
          errors.push(`location.${field} must be a string or null.`);
        }
      }
      if (typeof input.location.district === "string" && !RWANDA_DISTRICTS.has(input.location.district)) {
        errors.push("location.district must be a recognized Rwanda district.");
      }
      if (typeof input.location.workMode === "string" &&
        !["onsite", "in_person", "hybrid", "remote", "unspecified"].includes(input.location.workMode)) {
        errors.push("location.workMode is not a supported work mode.");
      }
    }
  }
  if (input.suitabilitySignals !== undefined && input.suitabilitySignals !== null &&
    !validSuitabilitySignals(input.suitabilitySignals)) {
    errors.push("suitabilitySignals must contain structured, evidenced skill and interest signals.");
  }
  if (input.careerFamilies !== undefined && !validCareerFamilies(input.careerFamilies)) {
    errors.push("careerFamilies must contain structured, evidenced family signals.");
  }
  if (input.provenance !== undefined && !validProvenance(input.provenance)) {
    errors.push("provenance must contain source-backed field references.");
  }
  if (input.mandatoryRequirementsDisclosure !== undefined && !isDisclosure(input.mandatoryRequirementsDisclosure)) {
    errors.push("mandatoryRequirementsDisclosure must be complete, partial, or unknown.");
  }
  if (!isRecord(input.verification) ||
    !VERIFICATION_STATES.includes(input.verification.state as (typeof VERIFICATION_STATES)[number])) {
    errors.push("verification.state is not a supported catalogue value.");
  } else if (input.verification.lastVerifiedAt !== undefined && input.verification.lastVerifiedAt !== null &&
    !validDate(input.verification.lastVerifiedAt)) {
    errors.push("verification.lastVerifiedAt must be a valid date or date-time.");
  }
  if (input.deadline !== undefined && input.deadline !== null && !isNonEmptyString(input.deadline)) {
    errors.push("deadline must be a non-empty source value or null.");
  }
  if (input.metadata !== undefined && input.metadata !== null) {
    if (!isRecord(input.metadata)) errors.push("metadata must be an object or null.");
    else {
      for (const field of ["isSynthetic", "isLiveOpportunity"] as const) {
        if (input.metadata[field] !== undefined && typeof input.metadata[field] !== "boolean") {
          errors.push(`metadata.${field} must be a boolean.`);
        }
      }
      if (input.metadata.category !== undefined && input.metadata.category !== null &&
        !isNonEmptyString(input.metadata.category)) errors.push("metadata.category must be a non-empty string.");
      if (input.metadata.asOf !== undefined && input.metadata.asOf !== null && !isNonEmptyString(input.metadata.asOf)) {
        errors.push("metadata.asOf must be a non-empty string or null.");
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function hasProfileSkill(profile: UserProfile, skillName: string): ProfileSkill | undefined {
  return (profile.skills ?? []).find((skill) => normalize(skill.name) === normalize(skillName));
}