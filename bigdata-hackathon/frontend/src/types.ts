export const opportunityTypes = [
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

export type OpportunityType = (typeof opportunityTypes)[number];
export type OpportunityStatus =
  | "open"
  | "closed"
  | "rolling"
  | "needs_confirmation"
  | "rolling_example"
  | "synthetic_example";
export type DeadlineStatus = "confirmed" | "historical" | "not_confirmed" | "rolling";
export type EligibilityOutcome = "eligible" | "ineligible" | "unknown";

export interface Opportunity {
  id: string;
  type: OpportunityType;
  title: string;
  organization: { name: string; kind?: string | null };
  description?: string;
  source: { id: string; name: string; url?: string | null; attribution?: string | null };
  applicationUrl?: string | null;
  requirements: Array<
    | string
    | {
        id: string;
        description: string;
        importance: "mandatory" | "preferred" | "unknown";
        certainty: "known" | "unknown" | "not_stated";
      }
  >;
  status: OpportunityStatus;
  deadline?: string | null;
  deadlineStatus: DeadlineStatus;
  duration?: string | null;
  costAndFunding: {
    cost?: string | number | null;
    costCertainty?: string | null;
    benefits?: string[] | null;
    fundingCertainty?: string | null;
  };
  location?: {
    country?: string | null;
    province?: string | null;
    district?: string | null;
    displayLocation?: string | null;
    workMode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    coordinateType?: "district_reference" | null;
  };
  verification: {
    state: "verified_listing" | "needs_confirmation" | "synthetic";
    lastVerifiedAt?: string | null;
    verificationNote?: string | null;
  };
  metadata?: {
    isSynthetic?: boolean;
    isLiveOpportunity?: boolean;
    category?: string;
    asOf?: string | null;
  };
}

export interface UserProfile {
  age?: number;
  residenceCountryCode?: string;
  preferredLocations?: string[];
  qualifications?: Array<{ name: string; level?: string; fieldOfStudy?: string }>;
  qualificationDisclosure?: "complete" | "partial" | "unknown";
  skills?: Array<{ name: string; proficiency?: "beginner" | "intermediate" | "advanced" | "expert" }>;
  skillDisclosure?: "complete" | "partial" | "unknown";
  workExperience?: Array<{ role: string; years: number; areas?: string[] }>;
  workExperienceDisclosure?: "complete" | "partial" | "unknown";
  projects?: Array<{ name: string; description?: string; skillNames?: string[] }>;
  interests?: string[];
  interestDisclosure?: "complete" | "partial" | "unknown";
  careerGoals?: string[];
  preferredCategories?: string[];
  preferredOpportunityTypes?: OpportunityType[];
}

export interface RequirementEvaluation {
  requirementId: string;
  description: string;
  importance: "mandatory" | "preferred" | "unknown";
  status: "satisfied" | "unmet" | "unresolved";
  explanation: string;
}

export interface EligibilityResult {
  outcome: EligibilityOutcome;
  explanation: string;
  satisfied: RequirementEvaluation[];
  unmet: RequirementEvaluation[];
  unresolved: RequirementEvaluation[];
  preferred: RequirementEvaluation[];
}

export interface Recommendation {
  opportunityId: string;
  title: string;
  organization: string;
  applicationUrl?: string | null;
  opportunity: Opportunity;
  eligibility: EligibilityResult;
  suitability: {
    score: number | null;
    scoreMeaning: string;
    evidenceCoveragePercent: number;
    components: Array<{
      factor: string;
      weight: number;
      score: number | null;
      explanation: string;
      matchedEvidence: string[];
      nonMatchingEvidence: string[];
      unresolvedEvidence: string[];
    }>;
  };
}

export interface OpportunityPage {
  success: true;
  data: {
    opportunities: Opportunity[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    source: { name: string; version: string; asOf?: string | null; warning: string };
  };
}

export interface OpportunityDetailResponse {
  success: true;
  data: { opportunity: Opportunity; source: { name: string; warning: string } };
}

export interface OpportunityMatchResponse {
  success: true;
  data: Recommendation[];
  source: { name: string; warning: string };
}

export interface EligibilityResponse {
  success: true;
  data: {
    opportunityId: string;
    eligibility: EligibilityResult;
    opportunity: Opportunity;
    source: { name: string; warning: string };
  };
}

export interface ApiErrorResponse {
  success: false;
  error?: { code?: string; message?: string; details?: string[] };
}

export interface NISRResponse<T> {
  success: true;
  data: T;
}

export interface NISRSource {
  name: string;
  sourceYear: number;
  records?: number;
}

export interface NISROverview {
  generatedAt: string;
  sources: {
    labourForceSurvey: NISRSource;
    establishmentCensus: NISRSource;
  };
  methodology: Record<string, string[]>;
  overview: Record<
    string,
    { value?: number; unit?: string; denominator?: string; unweightedRecords?: number }
  >;
  census: {
    sourceYear: number;
    establishmentRecords: number;
    exactDuplicateRowsRetained: number;
    workforceTotals: Record<string, number>;
  };
}

export interface NISRLabourMarket {
  source: NISRSource;
  methodology: string[];
  overview: Record<
    string,
    { value?: number; unit?: string; denominator?: string; unweightedRecords?: number }
  >;
  dimensions: Record<string, Array<{ code: number; label: string; metrics?: Record<string, unknown> }>>;
  employmentBySector: {
    categories: Array<{ label: string; sharePercent?: number | null; weightedEstimate?: number | null }>;
  };
  employmentByOccupation: {
    categories: Array<{ label: string; sharePercent?: number | null; weightedEstimate?: number | null }>;
  };
}

export interface NISREducationDistribution {
  variableLabel: string;
  validUnweightedRecords: number;
  categories: Array<{
    label: string;
    sharePercent: number | null;
    weightedEstimate: number | null;
  }>;
}

export interface NISREducation {
  source: NISRSource;
  methodology: string[];
  distributions: Record<string, NISREducationDistribution>;
  limitations: string[];
}

export interface NISREstablishmentGroup {
  code: number | null;
  label: string;
  establishmentRecords: number;
  workforce: {
    Male_worker: number;
    Female_worker: number;
    Total_workers: number;
    Rwandan_workers: number;
    Foregner_workers: number;
  };
}

export interface NISREstablishments {
  source: NISRSource;
  methodology: string[];
  sourceYear: number;
  establishmentRecords: number;
  exactDuplicateRowsRetained: number;
  workforceTotals: Record<string, number>;
  dimensions: Record<string, NISREstablishmentGroup[]>;
  limitations: string[];
}

export interface ActionPlanItem {
  recommendation: Recommendation;
  completed: boolean[];
}
