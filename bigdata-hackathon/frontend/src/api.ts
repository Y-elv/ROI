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
      throw new ApiError(
        `Could not connect to the API at ${apiBase}. Check the service status and browser network or CORS errors, then retry.`,
        0,
      );
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (response.ok) {
      throw new ApiError("The API returned a response that was not valid JSON.", response.status);
    }
  }
  if (!response.ok) {
    const errorBody = body as {
      error?: { code?: string; message?: string; details?: string[] };
      message?: string;
    } | undefined;
    throw new ApiError(
      errorBody?.error?.message || errorBody?.message || `Request failed with status ${response.status}.`,
      response.status,
      errorBody?.error?.code,
      errorBody?.error?.details,
    );
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
  isSynthetic: string;
  isLiveOpportunity: string;
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
      throw new ApiError(`Could not connect to the API at ${apiBase}. Check the service status and browser network or CORS errors, then retry.`, 0);
    }
    throw error;
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const errorBody: unknown = await response.json();
      if (typeof errorBody === "object" && errorBody !== null && "error" in errorBody) {
        const apiError = errorBody.error;
        if (typeof apiError === "object" && apiError !== null && "message" in apiError && typeof apiError.message === "string") {
          message = apiError.message;
        }
      }
    } catch {
      message = `Request failed with status ${response.status}.`;
    }
    throw new ApiError(message, response.status);
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
