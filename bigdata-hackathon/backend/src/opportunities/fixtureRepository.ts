import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { validateOpportunity } from "./eligibility";
import { Opportunity } from "./types";

const CATALOGUE_PATH = path.resolve(__dirname, "../../data/fixtures/rwanda-opportunity-demo-30.json");
const MAX_CATALOGUE_BYTES = 2 * 1024 * 1024;

export interface CatalogueCoverage {
  country?: string;
  opportunityCount?: number;
  sources?: Array<{ name: string; url: string }>;
  districts?: string[];
  provinces?: string[];
  [key: string]: unknown;
}

export interface CatalogueDatasetInfo {
  datasetName: string;
  datasetVersion: string;
  purpose: string;
  warning: string;
  asOf?: string;
  coverage: CatalogueCoverage;
  [key: string]: unknown;
}

export interface CatalogueDataset {
  info: CatalogueDatasetInfo;
  opportunities: Opportunity[];
  duplicateIds: string[];
  declaredOpportunityCount?: number;
  recordCountMatchesDeclaration: boolean | null;
}

export class FixtureDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureDataError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseCatalogueDocument(input: unknown): CatalogueDataset {
  if (!isRecord(input) || !isRecord(input.coverage) || !Array.isArray(input.opportunities)) {
    throw new FixtureDataError("Canonical catalogue has an invalid top-level structure.");
  }
  for (const field of ["datasetName", "datasetVersion", "purpose", "warning"] as const) {
    if (!nonEmptyString(input[field])) {
      throw new FixtureDataError(`Canonical catalogue ${field} is missing or invalid.`);
    }
  }

  const opportunities = input.opportunities.map((record, index) => {
    const validation = validateOpportunity(record);
    if (!validation.valid) {
      throw new FixtureDataError(`Catalogue opportunity ${index + 1} is invalid: ${validation.errors.join(" ")}`);
    }
    return record as Opportunity;
  });
  const idCounts = new Map<string, number>();
  for (const opportunity of opportunities) {
    idCounts.set(opportunity.id, (idCounts.get(opportunity.id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  const declaredOpportunityCount = typeof input.coverage.opportunityCount === "number"
    ? input.coverage.opportunityCount
    : undefined;

  return {
    info: {
      ...input,
      datasetName: input.datasetName,
      datasetVersion: input.datasetVersion,
      purpose: input.purpose,
      warning: input.warning,
      coverage: input.coverage,
    } as CatalogueDatasetInfo,
    opportunities,
    duplicateIds,
    declaredOpportunityCount,
    recordCountMatchesDeclaration: declaredOpportunityCount === undefined
      ? null
      : declaredOpportunityCount === opportunities.length,
  };
}

export interface CatalogueRepository {
  load(): Promise<CatalogueDataset>;
  getById(id: string): Promise<Opportunity | undefined>;
}

export function createCatalogueRepository(
  readDocument: () => Promise<unknown> = async () => {
    const fileInfo = await stat(CATALOGUE_PATH);
    if (fileInfo.size > MAX_CATALOGUE_BYTES) {
      throw new FixtureDataError("Canonical catalogue exceeds the allowed file size.");
    }
    const raw = await readFile(CATALOGUE_PATH, "utf-8");
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new FixtureDataError("Canonical catalogue contains malformed JSON.");
    }
  },
): CatalogueRepository {
  let cached: Promise<CatalogueDataset> | undefined;
  const load = (): Promise<CatalogueDataset> => {
    if (!cached) {
      cached = readDocument().then(parseCatalogueDocument).catch((error: unknown) => {
        cached = undefined;
        if (error instanceof FixtureDataError) throw error;
        throw new FixtureDataError("Unable to load the canonical opportunity catalogue.");
      });
    }
    return cached;
  };

  return {
    load,
    async getById(id) {
      const dataset = await load();
      const matches = dataset.opportunities.filter((opportunity) => opportunity.id === id);
      return matches.length === 1 ? matches[0] : undefined;
    },
  };
}

export type DemoFixtureCoverage = CatalogueCoverage;
export type DemoFixtureDatasetInfo = CatalogueDatasetInfo;
export type DemoFixtureDataset = CatalogueDataset;
export type DemoFixtureRepository = CatalogueRepository;
export const createDemoFixtureRepository = createCatalogueRepository;
export const parseDemoFixtureDocument = parseCatalogueDocument;

export const canonicalCatalogueRepository = createCatalogueRepository();
export const demoFixtureRepository = canonicalCatalogueRepository;
