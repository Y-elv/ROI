import { Opportunity } from "../types";

export type ConnectorStatus = "not_configured" | "disabled" | "available" | "unavailable";

export interface ConnectorDescriptor {
  id: string;
  name: string;
  status: ConnectorStatus;
  attribution: string;
  termsUrl?: string;
  isSynthetic: false;
  isLiveOpportunity: true;
}

export interface SafeSourceRequestOptions {
  allowedHostnames: readonly string[];
  timeoutMs: number;
  maxResponseBytes: number;
  allowRedirects: false;
}

export interface SafeSourceResponse {
  statusCode: number;
  contentType: string | undefined;
  body: unknown;
}

export interface SafeSourceTransport {
  get(url: string, options: SafeSourceRequestOptions): Promise<SafeSourceResponse>;
}

export interface OpportunitySourceConnector {
  readonly descriptor: ConnectorDescriptor;
  fetchPage(transport: SafeSourceTransport, cursor?: string): Promise<unknown>;
  normalizeAndValidate(payload: unknown): Opportunity[];
}