export const OPPORTUNITY_TYPES = [
  "job",
  "internship",
  "apprenticeship",
  "scholarship",
  "training",
  "entrepreneurship",
  "business_support",
  "certification",
  "education",
  "industrial_placement",
  "livelihoods",
  "study_loan",
  "tvet",
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export const OPPORTUNITY_STATUSES = [
  "open",
  "closed",
  "rolling",
  "needs_confirmation",
  "rolling_example",
  "synthetic_example",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export const DEADLINE_STATUSES = ["confirmed", "historical", "not_confirmed", "rolling"] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];
export const VERIFICATION_STATES = ["verified_listing", "needs_confirmation", "synthetic"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];
export type RequirementCertainty = "known" | "unknown" | "not_stated" | "source_stated";
export type RequirementImportance = "mandatory" | "preferred" | "unknown";
export type EligibilityOutcome = "eligible" | "ineligible" | "unknown";
export type DisclosureState = "complete" | "partial" | "unknown";
export type ProficiencyLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type WorkMode = "onsite" | "in_person" | "hybrid" | "remote" | "unspecified";

export interface EvidenceReference {
  kind: "self_reported" | "self_taught" | "document" | "project" | "portfolio" | "work" | "assessment" | "source_listing" | "other";
  description: string;
  uri?: string;
  observedAt?: string;
  verified?: boolean;
}

export interface Qualification {
  name: string;
  level?: string;
  fieldOfStudy?: string;
  institution?: string;
  completedAt?: string;
  evidence?: EvidenceReference[];
}

export interface ProfileSkill {
  name: string;
  proficiency?: ProficiencyLevel;
  evidence?: EvidenceReference[];
}

export interface ProjectExperience {
  name: string;
  description?: string;
  skillNames?: string[];
  uri?: string;
  evidence?: EvidenceReference[];
}

export interface WorkExperience {
  role: string;
  organization?: string;
  years: number;
  areas?: string[];
  evidence?: EvidenceReference[];
}

export type ProfileFactValue = string | number | boolean | string[];

export type ProfileFact =
  | { certainty: "known"; value: ProfileFactValue; evidence?: EvidenceReference[] }
  | { certainty: "unknown"; evidence?: EvidenceReference[] };

export interface UserProfile {
  age?: number;
  internetAccess?: "reliable" | "limited" | "none" | "unknown";
  residenceCountryCode?: string;
  citizenshipCountryCodes?: string[];
  workAuthorizationCountryCodes?: string[];
  countryDisclosure?: DisclosureState;
  qualifications?: Qualification[];
  qualificationDisclosure?: DisclosureState;
  skills?: ProfileSkill[];
  skillDisclosure?: DisclosureState;
  projects?: ProjectExperience[];
  workExperience?: WorkExperience[];
  workExperienceDisclosure?: DisclosureState;
  certifications?: Qualification[];
  certificationDisclosure?: DisclosureState;
  interests?: string[];
  careerGoals?: string[];
  preferredCategories?: string[];
  preferredLocations?: string[];
  interestDisclosure?: DisclosureState;
  preferredCountryCodes?: string[];
  preferredWorkModes?: WorkMode[];
  preferredOpportunityTypes?: OpportunityType[];
  facts?: Record<string, ProfileFact>;
}

export type RequirementCriterion =
  | { kind: "minimum_age"; years: number }
  | { kind: "maximum_age"; years: number }
  | {
      kind: "country_eligibility";
      basis: "residence" | "citizenship" | "work_authorization";
      allowedCountryCodes: string[];
    }
  | { kind: "education"; acceptedLevels: string[]; acceptedFieldsOfStudy?: string[] }
  | { kind: "skill"; name: string; minimumProficiency?: ProficiencyLevel }
  | { kind: "minimum_experience"; years: number; relatedArea?: string }
  | { kind: "certification"; name: string }
  | { kind: "profile_fact"; key: string; expectedValue: ProfileFactValue };

interface RequirementBase {
  id: string;
  description: string;
  importance: RequirementImportance;
  evidence?: EvidenceReference[];
}

export type OpportunityRequirement =
  | (RequirementBase & { certainty: "known"; criterion: RequirementCriterion })
  | (RequirementBase & { certainty: "unknown" | "not_stated"; criterion?: never });

export interface OpportunityLocation {
  country?: string | null;
  province?: string | null;
  district?: string | null;
  displayLocation?: string | null;
  workMode?: WorkMode | null;
  [key: string]: unknown;
}

export interface OpportunitySkillSignal {
  name: string;
  minimumProficiency?: ProficiencyLevel;
  evidence: EvidenceReference[];
}

export interface OpportunityInterestSignal {
  value: string;
  evidence: EvidenceReference[];
}

export interface CareerFamilySignal {
  family: string;
  terms: string[];
  confidence: "source_stated" | "taxonomy_inferred";
  evidence: EvidenceReference[];
}

export interface OpportunitySuitabilitySignals {
  skills?: Array<OpportunitySkillSignal & {
    purpose?: "required" | "preferred" | "learning_outcome" | "related";
  }>;
  interests?: OpportunityInterestSignal[];
}

export interface MonetaryEvidence {
  amount: number;
  currency: string;
  description: string;
  evidence: EvidenceReference[];
}

export interface CostAndFunding {
  cost?: string | number | null;
  costCertainty?: string | null;
  benefits?: string[] | null;
  fundingCertainty?: string | null;
  [key: string]: unknown;
}

export interface OpportunitySource {
  id: string;
  name: string;
  url?: string | null;
  attribution?: string | null;
  [key: string]: unknown;
}

export interface OpportunityProvenance {
  field: string;
  sourceId: string;
  certainty: "known" | "source_stated" | "taxonomy_inferred" | "unknown";
  evidence: EvidenceReference[];
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  organization: { name: string; kind?: string | null; [key: string]: unknown };
  description?: string;
  source: OpportunitySource;
  applicationUrl?: string | null;
  requirements: Array<string | OpportunityRequirement>;
  status: OpportunityStatus;
  deadline?: string | null;
  deadlineStatus: DeadlineStatus;
  duration?: string | null;
  costAndFunding: CostAndFunding;
  suitabilitySignals?: OpportunitySuitabilitySignals;
  careerFamilies?: CareerFamilySignal[];
  provenance?: OpportunityProvenance[];
  mandatoryRequirementsDisclosure?: DisclosureState;
  location?: OpportunityLocation;
  verification: {
    state: VerificationState;
    lastVerifiedAt?: string | null;
    verificationNote?: string | null;
    [key: string]: unknown;
  };
  metadata?: {
    isSynthetic?: boolean;
    isLiveOpportunity?: boolean;
    category?: string;
    asOf?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type RequirementEvaluationStatus = "satisfied" | "unmet" | "unresolved";

export interface RequirementEvaluation {
  requirementId: string;
  description: string;
  importance: RequirementImportance;
  status: RequirementEvaluationStatus;
  explanation: string;
  sourceEvidence?: EvidenceReference[];
  profileEvidence?: string[];
  actionToResolve?: string;
}

export interface EligibilityResult {
  outcome: EligibilityOutcome;
  explanation: string;
  satisfied: RequirementEvaluation[];
  unmet: RequirementEvaluation[];
  unresolved: RequirementEvaluation[];
  preferred: RequirementEvaluation[];
}

export type SuitabilityFactor =
  | "skills"
  | "interests"
  | "locationAndWorkMode"
  | "opportunityType"
  | "profileAlignment"
  | "careerAlignment"
  | "education"
  | "experience";

export interface MatchingWeights {
  skills: number;
  interests: number;
  locationAndWorkMode: number;
  opportunityType: number;
  profileAlignment?: number;
  careerAlignment?: number;
  education?: number;
  experience?: number;
}

export interface SuitabilityComponent {
  factor: SuitabilityFactor;
  weight: number;
  score: number | null;
  explanation: string;
  matchedEvidence: string[];
  nonMatchingEvidence: string[];
  unresolvedEvidence: string[];
}

export interface RecommendationResult {
  opportunityId: string;
  title: string;
  organization: string;
  applicationUrl?: string | null;
  opportunity: Opportunity;
  eligibility: EligibilityResult;
  guidance: {
    action:
      | "consider_applying"
      | "apply_with_gaps"
      | "build_experience_first"
      | "build_skills_first"
      | "pursue_training_or_certification"
      | "explore_further_study"
      | "insufficient_information";
    reasons: string[];
    gaps: string[];
    nextStep: string;
    targetOutcome: string;
    supportingOpportunityIds: string[];
    uncertainty: string[];
  };
  suitability: {
    score: number | null;
    scoreMeaning: string;
    evidenceCoveragePercent: number;
    components: SuitabilityComponent[];
  };
}

export interface OpportunityValidationResult {
  valid: boolean;
  errors: string[];
}