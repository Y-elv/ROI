import { evaluateEligibility, hasProfileSkill, validateOpportunity } from "./eligibility";
import {
  MatchingWeights,
  Opportunity,
  OpportunityRequirement,
  ProfileSkill,
  ProficiencyLevel,
  RecommendationResult,
  RequirementCriterion,
  SuitabilityComponent,
  SuitabilityFactor,
  UserProfile,
} from "./types";

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  skills: 0.45,
  interests: 0.25,
  locationAndWorkMode: 0.2,
  opportunityType: 0.1,
  profileAlignment: 0.2,
};

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const SCORE_MEANING = "Suitability ranking only; this score is not a probability of hiring, admission, or funding.";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function knownSkillRequirements(opportunity: Opportunity): Array<Extract<RequirementCriterion, { kind: "skill" }>> {
  const listedSkills = opportunity.requirements
    .filter((requirement): requirement is Extract<OpportunityRequirement, { certainty: "known" }> =>
      typeof requirement !== "string" && requirement.certainty === "known")
    .map((requirement) => requirement.criterion)
    .filter((criterion): criterion is Extract<RequirementCriterion, { kind: "skill" }> => criterion.kind === "skill");
  const allSkills = [
    ...listedSkills,
    ...(opportunity.suitabilitySignals?.skills ?? []).map((skill) => ({
      kind: "skill" as const,
      name: skill.name,
      minimumProficiency: skill.minimumProficiency,
    })),
  ];
  return [...new Map(allSkills.map((skill) => [normalize(skill.name), skill])).values()];
}

function scoreProfileAlignment(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const opportunityText = [
    opportunity.title,
    opportunity.description,
    opportunity.metadata?.category,
    ...opportunity.requirements.map((requirement) =>
      typeof requirement === "string" ? requirement : requirement.description),
  ].filter((value): value is string => typeof value === "string").map(normalize).join(" ");
  const evidence = [
    ...(profile.qualifications ?? []).flatMap((qualification) =>
      [qualification.level, qualification.fieldOfStudy, qualification.name].filter((value): value is string => Boolean(value))),
    ...(profile.projects ?? []).flatMap((project) =>
      [project.name, project.description].filter((value): value is string => Boolean(value))),
    ...(profile.workExperience ?? []).flatMap((experience) =>
      [experience.role, ...(experience.areas ?? [])]),
    ...(profile.careerGoals ?? []),
    ...(profile.preferredCategories ?? []),
  ];
  const distinctEvidence = [...new Set(evidence.map((value) => value.trim()).filter(Boolean))];
  if (distinctEvidence.length === 0) {
    return {
      factor: "profileAlignment",
      weight,
      score: null,
      explanation: "No education, project, experience, or career-goal evidence was supplied for pathway comparison.",
      matchedEvidence: [],
      nonMatchingEvidence: [],
      unresolvedEvidence: ["Profile alignment is not comparable without profile evidence."],
    };
  }
  const matchedEvidence = distinctEvidence.filter((value) => opportunityText.includes(normalize(value)));
  const nonMatchingEvidence = distinctEvidence.filter((value) => !matchedEvidence.includes(value));
  return {
    factor: "profileAlignment",
    weight,
    score: round((matchedEvidence.length / distinctEvidence.length) * 100),
    explanation: `${matchedEvidence.length} of ${distinctEvidence.length} stated education, project, experience, or career-goal items appear in the catalogue description.`,
    matchedEvidence,
    nonMatchingEvidence,
    unresolvedEvidence: [],
  };
}

function minimumProficiencyMet(skill: ProfileSkill, expected: ProficiencyLevel | undefined): boolean | undefined {
  if (!expected) return true;
  if (!skill.proficiency) return undefined;
  return PROFICIENCY_RANK[skill.proficiency] >= PROFICIENCY_RANK[expected];
}

function scoreSkills(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const expected = knownSkillRequirements(opportunity);
  const matchedEvidence: string[] = [];
  const nonMatchingEvidence: string[] = [];
  const unresolvedEvidence: string[] = [];
  let checked = 0;
  let matched = 0;

  for (const requirement of expected) {
    const skill = hasProfileSkill(profile, requirement.name);
    if (!skill) {
      if (profile.skillDisclosure === "complete") {
        checked += 1;
        nonMatchingEvidence.push(`${requirement.name}: not listed in a complete skills profile`);
      } else {
        unresolvedEvidence.push(`${requirement.name}: profile does not establish whether this skill is held`);
      }
      continue;
    }
    const proficiencyMet = minimumProficiencyMet(skill, requirement.minimumProficiency);
    if (proficiencyMet === undefined) {
      unresolvedEvidence.push(`${requirement.name}: proficiency is not stated`);
      continue;
    }
    checked += 1;
    if (proficiencyMet) {
      matched += 1;
      matchedEvidence.push(requirement.name);
    } else {
      nonMatchingEvidence.push(`${requirement.name}: stated proficiency is below the listed level`);
    }
  }

  const score = checked > 0 ? (matched / checked) * 100 : null;
  return {
    factor: "skills",
    weight,
    score: score === null ? null : round(score),
    explanation: score === null
      ? expected.length === 0
        ? "The opportunity provides no known skill criteria to compare."
        : "The profile does not contain enough skill evidence to score this factor."
      : `${matched} of ${checked} evidenced skill checks matched; unlisted skills in an incomplete profile were not treated as absent.`,
    matchedEvidence,
    nonMatchingEvidence,
    unresolvedEvidence,
  };
}

function scoreInterests(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const opportunityInterests = [...new Set((opportunity.suitabilitySignals?.interests ?? []).map((interest) => interest.value))];
  const profileInterests = profile.interests ?? [];
  const matched = opportunityInterests.filter((interest) => profileInterests.some((candidate) => normalize(candidate) === normalize(interest)));
  const complete = profile.interestDisclosure === "complete";
  const score = matched.length > 0
    ? complete ? (matched.length / Math.max(1, opportunityInterests.length)) * 100 : 100
    : complete && opportunityInterests.length > 0 ? 0 : null;
  return {
    factor: "interests",
    weight,
    score: score === null ? null : round(score),
    explanation: score === null
      ? "No comparable stated interest evidence is available."
      : `${matched.length} stated interest(s) matched; missing interests were not treated as a mismatch unless the profile declared its interests complete.`,
    matchedEvidence: matched,
    nonMatchingEvidence: score === 0 ? ["No listed opportunity interest matched the complete profile interest list."] : [],
    unresolvedEvidence: complete ? [] : ["Interest profile may be partial."],
  };
}

function scoreLocationAndMode(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const scores: number[] = [];
  const matchedEvidence: string[] = [];
  const nonMatchingEvidence: string[] = [];
  const unresolvedEvidence: string[] = [];
  const preferredLocations = profile.preferredLocations ?? [];
  const locationText = [
    opportunity.location?.country,
    opportunity.location?.province,
    opportunity.location?.district,
    opportunity.location?.displayLocation,
  ].filter((value): value is string => typeof value === "string").map(normalize);
  if (preferredLocations.length > 0 && locationText.length > 0) {
    const matches = preferredLocations.filter((preferred) =>
      locationText.some((location) => location.includes(normalize(preferred))));
    scores.push(matches.length > 0 ? 100 : 0);
    if (matches.length > 0) matchedEvidence.push(`Location matches preference: ${matches.join(", ")}.`);
    else nonMatchingEvidence.push("The stated location preferences do not match the listed location.");
  } else if (preferredLocations.length > 0) {
    unresolvedEvidence.push("The listing does not provide comparable location details.");
  }

  const preferredModes = profile.preferredWorkModes ?? [];
  const workMode = opportunity.location?.workMode ?? undefined;
  if (preferredModes.length > 0 && workMode && workMode !== "unspecified") {
    const match = preferredModes.includes(workMode) ||
      (workMode === "in_person" && preferredModes.includes("onsite")) ||
      (workMode === "onsite" && preferredModes.includes("in_person"));
    scores.push(match ? 100 : 0);
    if (match) matchedEvidence.push(`Work mode matches preference: ${workMode}.`);
    else nonMatchingEvidence.push(`Listed work mode ${workMode} does not match a stated preference.`);
  } else if (preferredModes.length > 0) {
    unresolvedEvidence.push("The listing does not state a work mode.");
  }

  const score = scores.length > 0 ? scores.reduce((total, value) => total + value, 0) / scores.length : null;
  return {
    factor: "locationAndWorkMode",
    weight,
    score: score === null ? null : round(score),
    explanation: score === null
      ? "There is not enough stated location or work-mode information to score this factor."
      : `${scores.length} documented location/work-mode comparison(s) were scored; unknown restrictions were not assumed compatible.`,
    matchedEvidence,
    nonMatchingEvidence,
    unresolvedEvidence,
  };
}

function scoreOpportunityType(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const preferences = profile.preferredOpportunityTypes ?? [];
  const score = preferences.length === 0 ? null : preferences.includes(opportunity.type) ? 100 : 0;
  return {
    factor: "opportunityType",
    weight,
    score,
    explanation: score === null
      ? "No opportunity-type preference was stated."
      : score === 100
        ? `The ${opportunity.type} type matches a stated preference.`
        : `The ${opportunity.type} type is not among the stated preferences; this affects suitability only, not eligibility.`,
    matchedEvidence: score === 100 ? [opportunity.type] : [],
    nonMatchingEvidence: score === 0 ? [`${opportunity.type} is not a stated preference.`] : [],
    unresolvedEvidence: [],
  };
}

function resolveWeights(overrides?: Partial<MatchingWeights>): MatchingWeights {
  if (overrides && Object.keys(overrides).length > 0 && Object.values(overrides).every((value) => value === 0)) {
    throw new RangeError("Matching weights must be finite, nonnegative, and have a positive total.");
  }
  const weights = { ...DEFAULT_MATCHING_WEIGHTS, ...overrides };
  const values = Object.values(weights);
  if (values.some((value) => !Number.isFinite(value) || value < 0) || values.every((value) => value === 0)) {
    throw new RangeError("Matching weights must be finite, nonnegative, and have a positive total.");
  }
  return weights;
}

export class InvalidOpportunityError extends Error {
  readonly validationErrors: string[];

  constructor(errors: string[]) {
    super(`Invalid opportunity: ${errors.join(" ")}`);
    this.name = "InvalidOpportunityError";
    this.validationErrors = errors;
  }
}

export function matchOpportunity(
  profile: UserProfile,
  opportunity: Opportunity,
  weightOverrides?: Partial<MatchingWeights>,
): RecommendationResult {
  const validation = validateOpportunity(opportunity);
  if (!validation.valid) throw new InvalidOpportunityError(validation.errors);
  const weights = resolveWeights(weightOverrides);
  const components: SuitabilityComponent[] = [
    scoreSkills(profile, opportunity, weights.skills),
    scoreInterests(profile, opportunity, weights.interests),
    scoreLocationAndMode(profile, opportunity, weights.locationAndWorkMode),
    scoreOpportunityType(profile, opportunity, weights.opportunityType),
    scoreProfileAlignment(profile, opportunity, weights.profileAlignment ?? 0),
  ];
  const applicable = components.filter((component) => component.score !== null && component.weight > 0);
  const configuredWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
  const appliedWeight = applicable.reduce((total, component) => total + component.weight, 0);
  const score = appliedWeight === 0
    ? null
    : round(applicable.reduce((total, component) => total + component.score! * component.weight, 0) / appliedWeight);

  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization.name,
    applicationUrl: opportunity.applicationUrl,
    opportunity,
    eligibility: evaluateEligibility(profile, opportunity),
    suitability: {
      score,
      scoreMeaning: opportunity.metadata?.isSynthetic === true
        ? `${SCORE_MEANING} The opportunity record is synthetic demo data and is not a genuine live listing.`
        : SCORE_MEANING,
      evidenceCoveragePercent: round(configuredWeight === 0 ? 0 : (appliedWeight / configuredWeight) * 100),
      components,
    },
  };
}

export function rankOpportunities(
  profile: UserProfile,
  opportunities: Opportunity[],
  weightOverrides?: Partial<MatchingWeights>,
): RecommendationResult[] {
  return opportunities
    .map((opportunity) => matchOpportunity(profile, opportunity, weightOverrides))
    .sort((left, right) => {
      if (left.suitability.score === null && right.suitability.score !== null) return 1;
      if (left.suitability.score !== null && right.suitability.score === null) return -1;
      if (left.suitability.score !== null && right.suitability.score !== null && left.suitability.score !== right.suitability.score) {
        return right.suitability.score - left.suitability.score;
      }
      return left.opportunityId.localeCompare(right.opportunityId);
    });
}