import { evaluateEligibility, validateOpportunity } from "./eligibility";
import { careerFamiliesForText, equivalentSkill, matchCareerFamilies } from "./careerTaxonomy";
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
  skills: 0.3,
  interests: 0.1,
  locationAndWorkMode: 0.08,
  opportunityType: 0.05,
  profileAlignment: 0.15,
  careerAlignment: 0.15,
  education: 0.1,
  experience: 0.07,
};

const PROFICIENCY_RANK: Record<ProficiencyLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const SCORE_MEANING = "Conservative weighted suitability score; unavailable evidence earns no positive points but remains unknown, not a mismatch. This is not a probability of hiring, admission, or funding.";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function scoreCareerAlignment(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const alignment = matchCareerFamilies(profile, opportunity);
  return {
    factor: "careerAlignment",
    weight,
    score: alignment.score,
    explanation: alignment.score === null
      ? "No career goal or preferred category was supplied for occupational alignment."
      : `${alignment.matched.length} of ${alignment.matched.length + alignment.unmatched.length} stated career goal(s) align with catalogue career-family signals.`,
    matchedEvidence: [...alignment.matched, ...alignment.inferred],
    nonMatchingEvidence: alignment.unmatched,
    unresolvedEvidence: alignment.score === null ? ["Career alignment is unknown without a stated goal."] : [],
  };
}

function scoreCriterionGroup(
  opportunity: Opportunity,
  eligibility: ReturnType<typeof evaluateEligibility>,
  kind: "education" | "experience",
  weight: number,
): SuitabilityComponent {
  const criterionKind = kind === "education" ? "education" : "minimum_experience";
  const known = opportunity.requirements.filter((requirement) =>
    typeof requirement !== "string" && requirement.certainty === "known" &&
    requirement.criterion.kind === criterionKind);
  if (known.length === 0) {
    return {
      factor: kind,
      weight,
      score: null,
      explanation: `The catalogue has no structured ${kind} criteria for comparison.`,
      matchedEvidence: [],
      nonMatchingEvidence: [],
      unresolvedEvidence: [`${kind} fit is unknown because no source-backed structured criterion is available.`],
    };
  }
  const evaluations = [...eligibility.satisfied, ...eligibility.unmet, ...eligibility.unresolved]
    .filter((entry) => known.some((requirement) =>
      typeof requirement !== "string" && requirement.id === entry.requirementId));
  const resolved = evaluations.filter((entry) => entry.status !== "unresolved");
  return {
    factor: kind,
    weight,
    score: resolved.length ? round((resolved.filter((entry) => entry.status === "satisfied").length / resolved.length) * 100) : null,
    explanation: `${resolved.length} source-backed ${kind} criterion(s) have profile evidence; unresolved criteria remain unknown.`,
    matchedEvidence: resolved.filter((entry) => entry.status === "satisfied").map((entry) => entry.description),
    nonMatchingEvidence: resolved.filter((entry) => entry.status === "unmet").map((entry) => entry.description),
    unresolvedEvidence: evaluations.filter((entry) => entry.status === "unresolved").map((entry) => entry.description),
  };
}

function buildGuidance(
  profile: UserProfile,
  opportunity: Opportunity,
  eligibility: ReturnType<typeof evaluateEligibility>,
  components: SuitabilityComponent[],
  score: number | null,
  evidenceCoveragePercent: number,
): RecommendationResult["guidance"] {
  const careerAlignment = components.find((component) => component.factor === "careerAlignment");
  const skillComponent = components.find((component) => component.factor === "skills");
  const relevantGoal = (careerAlignment?.score ?? 0) > 0;
  const gaps = [
    ...eligibility.unmet.map((entry) => entry.description),
    ...eligibility.unresolved.map((entry) => entry.description),
    ...(skillComponent?.nonMatchingEvidence ?? []),
  ];
  const uncertainty = [
    ...(evidenceCoveragePercent < 50 ? ["Less than half of configured scoring weight had comparable catalogue evidence."] : []),
    ...(opportunity.verification.state !== "verified_listing" ? ["Verify the opportunity and its current status with the listed source."] : []),
    ...(opportunity.deadlineStatus === "not_confirmed" ? ["The application deadline is not confirmed."] : []),
  ];
  let action: RecommendationResult["guidance"]["action"] = "insufficient_information";
  let nextStep = "Review the opportunity and confirm its requirements with the listed source.";
  const reasons: string[] = [];

  if (opportunity.metadata?.isSynthetic === true) {
    reasons.push("This catalogue entry is synthetic and cannot support real-world application guidance.");
  } else if (score === null || evidenceCoveragePercent < 20) {
    reasons.push("There is not enough comparable profile and catalogue evidence for a reliable next-step recommendation.");
  } else if (eligibility.unmet.some((entry) => entry.description.toLocaleLowerCase().includes("skill"))) {
    action = "build_skills_first";
    nextStep = "Build or document the specific skill identified in the unmet source-backed requirement, then reassess.";
    reasons.push("A documented skill criterion is unmet.");
  } else if (opportunity.type === "training" || opportunity.type === "certification") {
    action = relevantGoal ? "pursue_training_or_certification" : "insufficient_information";
    nextStep = relevantGoal
      ? "Check the current intake and curriculum with the provider before enrolling."
      : "Compare the programme focus with your stated career goal before treating it as a pathway.";
    reasons.push("This catalogue record is a learning opportunity, not a job offer.");
  } else if (opportunity.type === "scholarship" || opportunity.type === "education" || opportunity.type === "study_loan") {
    action = relevantGoal ? "explore_further_study" : "insufficient_information";
    nextStep = relevantGoal
      ? "Confirm the programme subject, award conditions, eligibility, and current application status with the source."
      : "Confirm that the programme supports your stated goal before considering further study.";
    reasons.push("Further study is suggested only when the catalogue has a career-aligned education record.");
  } else if ((opportunity.type === "internship" || opportunity.type === "apprenticeship" ||
    opportunity.type === "industrial_placement") && relevantGoal &&
    (profile.workExperience ?? []).length === 0) {
    action = "build_experience_first";
    nextStep = "Check placement eligibility and current availability; use the experience to build evidence for your stated career goal.";
    reasons.push("This is an experience-building opportunity aligned with a stated career family.");
  } else if (eligibility.outcome === "eligible") {
    action = "consider_applying";
    nextStep = "Review the full source listing and confirm it is still open before applying.";
    reasons.push("All disclosed mandatory requirements are satisfied; selection is not guaranteed.");
  } else if (eligibility.outcome === "ineligible") {
    action = "apply_with_gaps";
    nextStep = "Address or clarify the unmet requirement with the listed source before applying.";
    reasons.push("At least one documented mandatory requirement is unmet.");
  } else if (relevantGoal) {
    action = "apply_with_gaps";
    nextStep = "Confirm the unresolved requirements and current status with the listed source.";
    reasons.push("The catalogue career-family signal aligns with your stated goal, but eligibility remains uncertain.");
  } else {
    reasons.push("The available catalogue evidence does not establish a clear link to your stated goal.");
  }

  return {
    action,
    reasons,
    gaps,
    nextStep,
    targetOutcome: relevantGoal
      ? `Progress toward: ${(profile.careerGoals ?? profile.preferredCategories ?? []).join(", ")}`
      : "Clarify a career goal and compare it with source-backed opportunity evidence.",
    supportingOpportunityIds: opportunity.metadata?.isSynthetic === true ? [] : [opportunity.id],
    uncertainty,
  };
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
      [project.name, project.description, ...(project.skillNames ?? [])].filter((value): value is string => Boolean(value))),
    ...(profile.workExperience ?? []).flatMap((experience) =>
      [experience.role, ...(experience.areas ?? [])]),
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
  const opportunityFamilies = new Set((opportunity.careerFamilies ?? []).map((signal) => signal.family));
  const matchedEvidence = distinctEvidence.filter((value) =>
    opportunityText.includes(normalize(value)) ||
    careerFamiliesForText(value).some((family) => opportunityFamilies.has(family)));
  const nonMatchingEvidence = distinctEvidence.filter((value) => !matchedEvidence.includes(value));
  const inferred = matchedEvidence.filter((value) =>
    !opportunityText.includes(normalize(value)) &&
    careerFamiliesForText(value).some((family) => opportunityFamilies.has(family)));
  return {
    factor: "profileAlignment",
    weight,
    score: round((matchedEvidence.length / distinctEvidence.length) * 100),
    explanation: `${matchedEvidence.length} of ${distinctEvidence.length} stated education, project, or experience items align with catalogue text or a documented career-family signal.`,
    matchedEvidence: [
      ...matchedEvidence.filter((value) => !inferred.includes(value)),
      ...inferred.map((value) => `${value} (inferred career-family alignment)`),
    ],
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
  const signalSkills = (opportunity.suitabilitySignals?.skills ?? []).map((signal) => ({
    kind: "skill" as const,
    name: signal.name,
    minimumProficiency: signal.minimumProficiency,
  }));
  const comparableSkills = [...new Map([...expected, ...signalSkills].map((skill) => [normalize(skill.name), skill])).values()];
  const matchedEvidence: string[] = [];
  const nonMatchingEvidence: string[] = [];
  const unresolvedEvidence: string[] = [];
  let checked = 0;
  let matched = 0;

  for (const requirement of comparableSkills) {
    const skill = (profile.skills ?? []).find((entry) => equivalentSkill(entry.name, requirement.name));
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
      ? comparableSkills.length === 0
        ? "The opportunity provides no structured skill signals to compare."
        : "The profile does not contain enough skill evidence to score this factor."
      : `${matched} of ${checked} evidenced skill signals matched; these signals describe stated requirements or programme focus, not necessarily mandatory eligibility.`,
    matchedEvidence,
    nonMatchingEvidence,
    unresolvedEvidence,
  };
}

function scoreInterests(profile: UserProfile, opportunity: Opportunity, weight: number): SuitabilityComponent {
  const opportunityInterests = [...new Set((opportunity.suitabilitySignals?.interests ?? []).map((interest) => interest.value))];
  const profileInterests = profile.interests ?? [];
  const matched = opportunityInterests.filter((interest) => profileInterests.some((candidate) =>
    equivalentSkill(candidate, interest) ||
    careerFamiliesForText(candidate).some((family) => careerFamiliesForText(interest).includes(family))));
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
    const nationwideCoverage = locationText.some((location) => location.includes("nationwide")) &&
      opportunity.location?.country?.toLocaleLowerCase() === "rwanda";
    scores.push(matches.length > 0 || nationwideCoverage ? 100 : 0);
    if (matches.length > 0) matchedEvidence.push(`Location matches preference: ${matches.join(", ")}.`);
    else if (nationwideCoverage) matchedEvidence.push("The listing states nationwide coverage; no district-specific placement is inferred.");
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
  const eligibility = evaluateEligibility(profile, opportunity);
  const components: SuitabilityComponent[] = [
    scoreSkills(profile, opportunity, weights.skills),
    scoreInterests(profile, opportunity, weights.interests),
    scoreLocationAndMode(profile, opportunity, weights.locationAndWorkMode),
    scoreOpportunityType(profile, opportunity, weights.opportunityType),
    scoreProfileAlignment(profile, opportunity, weights.profileAlignment ?? 0),
    scoreCareerAlignment(profile, opportunity, weights.careerAlignment ?? 0),
    scoreCriterionGroup(opportunity, eligibility, "education", weights.education ?? 0),
    scoreCriterionGroup(opportunity, eligibility, "experience", weights.experience ?? 0),
  ];
  const applicable = components.filter((component) => component.score !== null && component.weight > 0);
  const configuredWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
  const appliedWeight = applicable.reduce((total, component) => total + component.weight, 0);
  const score = appliedWeight === 0
    ? null
    : round(applicable.reduce((total, component) => total + component.score! * component.weight, 0) / configuredWeight);

  const evidenceCoveragePercent = round(configuredWeight === 0 ? 0 : (appliedWeight / configuredWeight) * 100);
  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization.name,
    applicationUrl: opportunity.applicationUrl,
    opportunity,
    eligibility,
    guidance: buildGuidance(profile, opportunity, eligibility, components, score, evidenceCoveragePercent),
    suitability: {
      score,
      scoreMeaning: opportunity.metadata?.isSynthetic === true
        ? `${SCORE_MEANING} The opportunity record is synthetic demo data and is not a genuine live listing.`
        : SCORE_MEANING,
      evidenceCoveragePercent,
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