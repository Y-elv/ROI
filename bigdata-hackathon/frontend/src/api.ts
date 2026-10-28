import type {
  EligibilityResponse,
  NISREducation,
  NISREstablishments,
  NISRLabourMarket,
  NISROverview,
  NISRResponse,
  OpportunityDetailResponse,
  OpportunityMatchResponse,
  OpportunityPage,
  OpportunityType,
  UserProfile,
} from "./types";
import type { CvData, CvImproveResponse, CvLanguageCode } from "./cvTypes";

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBase = (configuredBase).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getUserFacingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 0) return "Unable to connect right now. Check your connection and try again.";
  if (error.status === 404) return "This item could not be found. It may no longer be available.";
  if (error.status === 429) return "Too many requests. Wait a moment and try again.";
  if (error.status === 503) return "This service is temporarily unavailable. Please try again later.";
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError("Unable to connect.", 0);
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new ApiError("Unexpected API response.", response.status);
    }
  }
  if (!response.ok) {
    const errorBody = body as {
      error?: { code?: string; message?: string; details?: string[] };
      message?: string;
    } | undefined;
    throw new ApiError("The request failed.", response.status, errorBody?.error?.code);
  }
  return body as T;
}

export interface OpportunityFilters {
  page: number;
  limit: number;
  type: OpportunityType | "";
  status: string;
  deadlineStatus: string;
  province: string;
  district: string;
  category: string;
}

export async function getOpportunities(filters: OpportunityFilters): Promise<OpportunityPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "") params.set(key, String(value));
  }
  return request(`/api/v1/opportunities?${params.toString()}`);
}

export function getOpportunity(id: string): Promise<OpportunityDetailResponse> {
  return request(`/api/v1/opportunities/${encodeURIComponent(id)}`);
}

export function getMatches(profile: UserProfile): Promise<OpportunityMatchResponse> {
  return request("/api/v1/opportunities/match", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

export function checkEligibility(
  profile: UserProfile,
  opportunityId: string,
): Promise<EligibilityResponse> {
  return request("/api/v1/opportunities/eligibility", {
    method: "POST",
    body: JSON.stringify({ profile, opportunityId }),
  });
}

export function improveCv(cv: CvData, language: CvLanguageCode): Promise<CvImproveResponse> {
  return request("/api/v1/cv/improve", {
    method: "POST",
    body: JSON.stringify({ cv, language }),
  });
}

export async function downloadCvDocument(cv: CvData, language: CvLanguageCode): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1/cv/docx`, {
      method: "POST",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Type": "application/json" },
      body: JSON.stringify({ cv, language }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError("Unable to connect.", 0);
    }
    throw error;
  }
  if (!response.ok) {
    throw new ApiError("The request failed.", response.status);
  }
  return response.blob();
}

export function getNisrOverview(): Promise<NISRResponse<NISROverview>> {
  return request("/api/v1/analytics/nisr");
}

export function getNisrLabourMarket(): Promise<NISRResponse<NISRLabourMarket>> {
  return request("/api/v1/analytics/nisr/labour-market");
}

export function getNisrEducation(): Promise<NISRResponse<NISREducation>> {
  return request("/api/v1/analytics/nisr/education");
}

export function getNisrEstablishments(): Promise<NISRResponse<NISREstablishments>> {
  return request("/api/v1/analytics/nisr/establishments");
}

export const API_BASE_URL = apiBase;
