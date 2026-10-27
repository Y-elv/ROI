import { Request, Response, Router } from "express";
import { evaluateEligibility, validateOpportunity } from "./eligibility";
import { InvalidOpportunityError, rankOpportunities } from "./matching";
import {
  DEADLINE_STATUSES,
  DeadlineStatus,
  MatchingWeights,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  ProficiencyLevel,
  UserProfile,
  VERIFICATION_STATES,
  WorkMode,
} from "./types";
import {
  CatalogueDataset,
  CatalogueRepository,
  FixtureDataError,
  canonicalCatalogueRepository,
} from "./fixtureRepository";

const DISCLOSURES = ["complete", "partial", "unknown"];
const PROFICIENCIES: ProficiencyLevel[] = ["beginner", "intermediate", "advanced", "expert"];
const WORK_MODES: WorkMode[] = ["onsite", "in_person", "hybrid", "remote", "unspecified"];
const MAX_PAGE_SIZE = 100;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 120;
const requestCounts = new Map<string, { windowStartedAt: number; count: number }>();

function rateLimit(req: Request, res: Response, next: () => void): void {
  const now = Date.now();
  const key = req.socket.remoteAddress ?? "unknown";
  const current = requestCounts.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS
    ? { windowStartedAt: now, count: 0 }
    : current;
  entry.count += 1;
  requestCounts.set(key, entry);
  if (requestCounts.size > 10_000) {
    for (const [address, value] of requestCounts) {
      if (now - value.windowStartedAt >= RATE_WINDOW_MS) requestCounts.delete(address);
    }
  }
  if (entry.count > RATE_LIMIT_PER_WINDOW) {
    res.status(429).json({
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many opportunity requests. Try again shortly." },
    });
    return;
  }
  next();
}

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function parseBoolean(value: unknown, name: string, errors: string[]): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    errors.push(`${name} must be a boolean.`);
    return undefined;
  }
  return value;
}

function parseBooleanQuery(value: string | undefined, name: string, errors: string[]): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  errors.push(`${name} must be true or false.`);
  return undefined;
}

function parsePageNumber(value: string | undefined, fallback: number, name: string, errors: string[]): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    errors.push(`${name} must be a nonnegative integer.`);
    return fallback;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    errors.push(`${name} must be a safe integer.`);
    return fallback;
  }
  return number;
}

function queryValidation(req: Request, allowed: readonly string[]): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(req.query)) {
    if (!allowed.includes(key)) errors.push(`Unsupported query parameter '${key}'.`);
    if (typeof value !== "string") errors.push(`Query parameter '${key}' must occur once and be a string.`);
  }
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateProfile(input: unknown): string[] {
  if (!isRecord(input)) return ["profile must be an object."];
  const errors: string[] = [];
  if (input.age !== undefined && (typeof input.age !== "number" || !Number.isFinite(input.age) || input.age < 0)) {
    errors.push("profile.age must be a nonnegative number when provided.");
  }
  for (const field of [
    "countryDisclosure", "qualificationDisclosure", "skillDisclosure", "workExperienceDisclosure",
    "certificationDisclosure", "interestDisclosure",
  ]) {
    if (input[field] !== undefined && !DISCLOSURES.includes(String(input[field]))) {
      errors.push(`profile.${field} must be complete, partial, or unknown.`);
    }
  }
  for (const field of [
    "citizenshipCountryCodes", "workAuthorizationCountryCodes", "interests", "careerGoals",
    "preferredCategories", "preferredLocations", "preferredCountryCodes",
  ]) {
    if (input[field] !== undefined && !isStringArray(input[field])) {
      errors.push(`profile.${field} must be an array of strings.`);
    }
  }
  if (input.residenceCountryCode !== undefined && typeof input.residenceCountryCode !== "string") {
    errors.push("profile.residenceCountryCode must be a string.");
  }
  if (input.internetAccess !== undefined && !["reliable", "limited", "none", "unknown"].includes(String(input.internetAccess))) {
    errors.push("profile.internetAccess has an invalid value.");
  }
  if (input.preferredWorkModes !== undefined &&
    (!Array.isArray(input.preferredWorkModes) || !input.preferredWorkModes.every((mode) => WORK_MODES.includes(mode)))) {
    errors.push("profile.preferredWorkModes contains an unsupported value.");
  }
  if (input.preferredOpportunityTypes !== undefined &&
    (!Array.isArray(input.preferredOpportunityTypes) ||
      !input.preferredOpportunityTypes.every((type) => OPPORTUNITY_TYPES.includes(type)))) {
    errors.push("profile.preferredOpportunityTypes contains an unsupported value.");
  }
  if (input.skills !== undefined && (!Array.isArray(input.skills) || !input.skills.every((skill) =>
    isRecord(skill) && isNonEmptyString(skill.name) &&
    (skill.proficiency === undefined || PROFICIENCIES.includes(skill.proficiency as ProficiencyLevel))))) {
    errors.push("profile.skills must contain a name and an optional recognized proficiency.");
  }
  for (const field of ["qualifications", "certifications"] as const) {
    if (input[field] !== undefined && (!Array.isArray(input[field]) || !input[field].every((qualification) =>
      isRecord(qualification) && isNonEmptyString(qualification.name) &&
      (qualification.level === undefined || typeof qualification.level === "string") &&
      (qualification.fieldOfStudy === undefined || typeof qualification.fieldOfStudy === "string")))) {
      errors.push(`profile.${field} must contain named qualifications.`);
    }
  }
  if (input.workExperience !== undefined && (!Array.isArray(input.workExperience) || !input.workExperience.every((experience) =>
    isRecord(experience) && isNonEmptyString(experience.role) &&
    typeof experience.years === "number" && Number.isFinite(experience.years) && experience.years >= 0 &&
    (experience.areas === undefined || isStringArray(experience.areas)))) ) {
    errors.push("profile.workExperience must contain a role and nonnegative years.");
  }
  if (input.projects !== undefined && (!Array.isArray(input.projects) || !input.projects.every((project) =>
    isRecord(project) && isNonEmptyString(project.name) &&
    (project.skillNames === undefined || isStringArray(project.skillNames)))) ) {
    errors.push("profile.projects must contain named projects.");
  }
  return errors;
}

function validateRequestProfile(body: Record<string, unknown>): { profile: UserProfile | undefined; errors: string[] } {
  const errors = validateProfile(body.profile);
  return { profile: errors.length === 0 ? body.profile as UserProfile : undefined, errors };
}

function sendInvalidRequest(res: Response, details: string[]): void {
  res.status(400).json({
    success: false,
    error: { code: "INVALID_REQUEST", message: "Request body failed validation.", details },
  });
}

function sendCatalogueUnavailable(res: Response): void {
  res.status(503).json({
    success: false,
    error: { code: "OPPORTUNITY_CATALOGUE_UNAVAILABLE", message: "The canonical opportunity catalogue is unavailable or invalid." },
  });
}

function catalogueSummary(dataset: CatalogueDataset) {
  return {
    id: "canonical-opportunity-catalogue",
    name: dataset.info.datasetName,
    version: dataset.info.datasetVersion,
    asOf: dataset.info.asOf ?? null,
    warning: dataset.info.warning,
    records: dataset.opportunities.length,
    declaredRecords: dataset.declaredOpportunityCount ?? null,
    recordCountMatchesDeclaration: dataset.recordCountMatchesDeclaration,
    duplicateIds: dataset.duplicateIds,
  };
}

function boolOption(value: unknown, name: string, errors: string[]): boolean {
  return parseBoolean(value, name, errors) ?? false;
}

function matchesCatalogueFilters(
  opportunity: Opportunity,
  filters: {
    type?: string;
    category?: string;
    status?: string;
    deadlineStatus?: string;
    includeSynthetic: boolean;
    includeClosed: boolean;
    includeNeedsConfirmation: boolean;
  },
): boolean {
  if (filters.type && opportunity.type !== filters.type) return false;
  if (filters.category && opportunity.metadata?.category?.toLocaleLowerCase() !== filters.category.toLocaleLowerCase()) return false;
  if (!filters.includeSynthetic && opportunity.metadata?.isSynthetic === true) return false;
  if (!filters.includeClosed && (opportunity.status === "closed" || opportunity.deadlineStatus === "historical")) return false;
  if (!filters.includeNeedsConfirmation &&
    (opportunity.status === "needs_confirmation" || opportunity.verification.state === "needs_confirmation")) return false;
  if (filters.status && opportunity.status !== filters.status) return false;
  if (filters.deadlineStatus && opportunity.deadlineStatus !== filters.deadlineStatus) return false;
  return true;
}

/**
 * @openapi
 * /api/v1/opportunities:
 *   get:
 *     summary: List records from the canonical opportunity catalogue
 *     description: Returns catalogue entries with source status preserved; listing presence does not establish current availability.
 *     tags: [Opportunities]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/OpportunityType'
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/OpportunityStatus'
 *       - in: query
 *         name: deadlineStatus
 *         schema:
 *           $ref: '#/components/schemas/DeadlineStatus'
 *       - in: query
 *         name: province
 *         schema:
 *           type: string
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isSynthetic
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isLiveOpportunity
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Catalogue page
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityListResponse'
 *       400:
 *         description: Invalid filter or pagination value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityRequestError'
 *       503:
 *         description: Canonical catalogue unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityRequestError'
 */
/**
 * @openapi
 * /api/v1/opportunities/sources:
 *   get:
 *     summary: List catalogue sources
 *     description: Returns the sources represented by catalogue entries; it does not claim that external connectors are operational.
 *     tags: [Opportunities]
 *     responses:
 *       200:
 *         description: Catalogue source attribution
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunitySourcesResponse'
 */
/**
 * @openapi
 * /api/v1/opportunities/{id}:
 *   get:
 *     summary: Retrieve a canonical catalogue record
 *     tags: [Opportunities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Canonical record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityDetailResponse'
 *       404:
 *         description: Record not found
 *       409:
 *         description: ID is duplicated in the catalogue
 *       503:
 *         description: Canonical catalogue unavailable
 */
/**
 * @openapi
 * /api/v1/opportunities/eligibility:
 *   post:
 *     summary: Evaluate a profile against one canonical catalogue record
 *     tags: [Opportunities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OpportunityEligibilityRequest'
 *     responses:
 *       200:
 *         description: Eligibility and catalogue source record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityEligibilityResponse'
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Record not found
 *       409:
 *         description: ID is duplicated in the catalogue
 */
/**
 * @openapi
 * /api/v1/opportunities/match:
 *   post:
 *     summary: Rank canonical catalogue records for a profile
 *     description: Synthetic, closed, and needs-confirmation entries are excluded by default. Scores indicate fit, not probability of success.
 *     tags: [Opportunities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OpportunityMatchRequest'
 *     responses:
 *       200:
 *         description: Ranked catalogue matches
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OpportunityMatchResponse'
 *       400:
 *         description: Invalid request
 *       503:
 *         description: Canonical catalogue unavailable
 */
export function createOpportunityRouter(repository: CatalogueRepository = canonicalCatalogueRepository): Router {
  const router = Router();
  router.use(rateLimit);

  router.get("/", async (req: Request, res: Response) => {
    const allowed = [
      "page", "limit", "type", "status", "deadlineStatus", "province", "district",
      "category", "isSynthetic", "isLiveOpportunity",
    ];
    const errors = queryValidation(req, allowed);
    const page = parsePageNumber(queryString(req, "page"), 1, "page", errors);
    const limit = parsePageNumber(queryString(req, "limit"), 20, "limit", errors);
    const type = queryString(req, "type");
    const status = queryString(req, "status");
    const deadlineStatus = queryString(req, "deadlineStatus");
    const province = queryString(req, "province");
    const district = queryString(req, "district");
    const category = queryString(req, "category");
    const isSynthetic = parseBooleanQuery(queryString(req, "isSynthetic"), "isSynthetic", errors);
    const isLiveOpportunity = parseBooleanQuery(queryString(req, "isLiveOpportunity"), "isLiveOpportunity", errors);
    if (limit < 1 || limit > MAX_PAGE_SIZE) errors.push(`limit must be between 1 and ${MAX_PAGE_SIZE}.`);
    if (page < 1) errors.push("page must be at least 1.");
    if (type && !OPPORTUNITY_TYPES.includes(type as OpportunityType)) errors.push("type is not a supported opportunity type.");
    if (status && !OPPORTUNITY_STATUSES.includes(status as OpportunityStatus)) errors.push("status is not supported.");
    if (deadlineStatus && !DEADLINE_STATUSES.includes(deadlineStatus as DeadlineStatus)) errors.push("deadlineStatus is not supported.");
    for (const [name, value] of [["province", province], ["district", district], ["category", category]] as const) {
      if (value !== undefined && (value.trim().length === 0 || value.length > 100)) errors.push(`${name} must be 1 to 100 characters.`);
    }
    if (errors.length > 0) {
      sendInvalidRequest(res, errors);
      return;
    }
    try {
      const dataset = await repository.load();
      const filtered = dataset.opportunities.filter((opportunity) =>
        (!type || opportunity.type === type) &&
        (!status || opportunity.status === status) &&
        (!deadlineStatus || opportunity.deadlineStatus === deadlineStatus) &&
        (!province || opportunity.location?.province?.toLocaleLowerCase() === province.toLocaleLowerCase()) &&
        (!district || opportunity.location?.district?.toLocaleLowerCase() === district.toLocaleLowerCase()) &&
        (!category || opportunity.metadata?.category?.toLocaleLowerCase() === category.toLocaleLowerCase()) &&
        (isSynthetic === undefined || opportunity.metadata?.isSynthetic === isSynthetic) &&
        (isLiveOpportunity === undefined || opportunity.metadata?.isLiveOpportunity === isLiveOpportunity));
      const start = (page - 1) * limit;
      res.status(200).json({
        success: true,
        data: {
          opportunities: filtered.slice(start, start + limit),
          pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
          source: catalogueSummary(dataset),
        },
      });
    } catch (error) {
      if (error instanceof FixtureDataError) sendCatalogueUnavailable(res);
      else res.status(500).json({ success: false, error: { code: "OPPORTUNITY_CATALOGUE_FAILED", message: "Unable to load opportunities." } });
    }
  });

  router.get("/sources", async (_req: Request, res: Response) => {
    try {
      const dataset = await repository.load();
      const groupedSources = new Map<string, { source: Opportunity["source"]; records: number }>();
      for (const opportunity of dataset.opportunities) {
        const existing = groupedSources.get(opportunity.source.id);
        if (existing) existing.records += 1;
        else groupedSources.set(opportunity.source.id, { source: opportunity.source, records: 1 });
      }
      res.status(200).json({
        success: true,
        data: {
          catalogue: catalogueSummary(dataset),
          sources: [...groupedSources.values()].map(({ source, records }) => ({
            ...source,
            status: "catalogued",
            records,
          })),
        },
      });
    } catch (error) {
      if (error instanceof FixtureDataError) sendCatalogueUnavailable(res);
      else res.status(500).json({ success: false, error: { code: "OPPORTUNITY_SOURCES_FAILED", message: "Unable to load source status." } });
    }
  });

  router.get("/:id", async (req: Request, res: Response) => {
    if (!req.params.id || req.params.id.length > 120) {
      sendInvalidRequest(res, ["id must be between 1 and 120 characters."]);
      return;
    }
    try {
      const dataset = await repository.load();
      const matches = dataset.opportunities.filter((opportunity) => opportunity.id === req.params.id);
      if (matches.length > 1) {
        res.status(409).json({
          success: false,
          error: { code: "OPPORTUNITY_ID_AMBIGUOUS", message: "The catalogue contains multiple records with this ID." },
        });
        return;
      }
      if (matches.length === 0) {
        res.status(404).json({ success: false, error: { code: "OPPORTUNITY_NOT_FOUND", message: "Opportunity was not found." } });
        return;
      }
      res.status(200).json({
        success: true,
        data: { opportunity: matches[0], source: catalogueSummary(dataset) },
      });
    } catch (error) {
      if (error instanceof FixtureDataError) sendCatalogueUnavailable(res);
      else res.status(500).json({ success: false, error: { code: "OPPORTUNITY_LOOKUP_FAILED", message: "Unable to retrieve opportunity." } });
    }
  });

  router.post("/eligibility", async (req: Request, res: Response) => {
    const body: unknown = req.body;
    if (!isRecord(body)) {
      sendInvalidRequest(res, ["Request body must be an object."]);
      return;
    }
    const { profile, errors } = validateRequestProfile(body);
    if (body.opportunity !== undefined) errors.push("Caller-supplied opportunities are no longer accepted; provide opportunityId from the canonical catalogue.");
    if (body.useDemoFixtures !== undefined && typeof body.useDemoFixtures !== "boolean") errors.push("useDemoFixtures must be a boolean.");
    if (!isNonEmptyString(body.opportunityId)) errors.push("opportunityId is required.");
    if (errors.length > 0 || !profile) {
      sendInvalidRequest(res, errors);
      return;
    }
    try {
      const dataset = await repository.load();
      const matches = dataset.opportunities.filter((opportunity) => opportunity.id === body.opportunityId);
      if (matches.length > 1) {
        res.status(409).json({
          success: false,
          error: { code: "OPPORTUNITY_ID_AMBIGUOUS", message: "The catalogue contains multiple records with this ID." },
        });
        return;
      }
      const opportunity = matches[0];
      if (!opportunity) {
        res.status(404).json({ success: false, error: { code: "OPPORTUNITY_NOT_FOUND", message: "Opportunity was not found." } });
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          opportunityId: opportunity.id,
          eligibility: evaluateEligibility(profile, opportunity),
          opportunity,
          source: catalogueSummary(dataset),
        },
      });
    } catch (error) {
      if (error instanceof FixtureDataError) sendCatalogueUnavailable(res);
      else res.status(500).json({ success: false, error: { code: "OPPORTUNITY_ELIGIBILITY_FAILED", message: "Unable to evaluate opportunity eligibility." } });
    }
  });

  router.post("/match", async (req: Request, res: Response) => {
    const body: unknown = req.body;
    if (!isRecord(body)) {
      sendInvalidRequest(res, ["Request body must be an object."]);
      return;
    }
    const { profile, errors } = validateRequestProfile(body);
    if (body.opportunities !== undefined) errors.push("Caller-supplied opportunities are no longer accepted; matching uses the canonical catalogue.");
    if (body.useDemoFixtures !== undefined && typeof body.useDemoFixtures !== "boolean") errors.push("useDemoFixtures must be a boolean.");
    const includeSynthetic = boolOption(body.includeSynthetic, "includeSynthetic", errors) || body.useDemoFixtures === true;
    const includeClosed = boolOption(body.includeClosed, "includeClosed", errors);
    const includeNeedsConfirmation = boolOption(body.includeNeedsConfirmation, "includeNeedsConfirmation", errors);
    if (body.type !== undefined &&
      (typeof body.type !== "string" || !OPPORTUNITY_TYPES.includes(body.type as OpportunityType))) {
      errors.push("type is not a supported opportunity type.");
    }
    if (body.status !== undefined &&
      (typeof body.status !== "string" || !OPPORTUNITY_STATUSES.includes(body.status as OpportunityStatus))) {
      errors.push("status is not supported.");
    }
    if (body.deadlineStatus !== undefined &&
      (typeof body.deadlineStatus !== "string" || !DEADLINE_STATUSES.includes(body.deadlineStatus as DeadlineStatus))) {
      errors.push("deadlineStatus is not supported.");
    }
    if (body.category !== undefined && !isNonEmptyString(body.category)) {
      errors.push("category must be a non-empty string.");
    }
    let weights: Partial<MatchingWeights> | undefined;
    if (body.weights !== undefined) {
      if (!isRecord(body.weights)) errors.push("weights must be an object.");
      else {
        const supported = ["skills", "interests", "locationAndWorkMode", "opportunityType", "profileAlignment"];
        for (const [key, value] of Object.entries(body.weights)) {
          if (!supported.includes(key)) errors.push(`weights.${key} is not a supported factor.`);
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
            errors.push(`weights.${key} must be a finite nonnegative number.`);
          }
        }
        weights = body.weights as Partial<MatchingWeights>;
      }
    }
    if (errors.length > 0 || !profile) {
      sendInvalidRequest(res, errors);
      return;
    }

    try {
      const dataset = await repository.load();
      const selected = dataset.opportunities.filter((opportunity) =>
        matchesCatalogueFilters(opportunity, {
          type: typeof body.type === "string" ? body.type : undefined,
          category: typeof body.category === "string" ? body.category : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
          deadlineStatus: typeof body.deadlineStatus === "string" ? body.deadlineStatus : undefined,
          includeSynthetic,
          includeClosed,
          includeNeedsConfirmation,
        }));
      const data = rankOpportunities(profile, selected, weights);
      res.status(200).json({ success: true, data, source: catalogueSummary(dataset) });
    } catch (error) {
      if (error instanceof FixtureDataError) sendCatalogueUnavailable(res);
      else if (error instanceof InvalidOpportunityError || error instanceof RangeError) sendInvalidRequest(res, [error.message]);
      else res.status(500).json({
        success: false,
        error: { code: "OPPORTUNITY_MATCH_FAILED", message: "Unable to evaluate opportunity matches." },
      });
    }
  });

  return router;
}
