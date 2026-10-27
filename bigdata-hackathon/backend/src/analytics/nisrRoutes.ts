import { readFile } from "node:fs/promises";
import path from "node:path";
import { Router, Request, Response } from "express";

export interface NISRAnalyticsDocument {
  schemaVersion: number;
  generatedAt: string;
  sources: Record<string, unknown>;
  methodology: Record<string, unknown>;
  labourMarket: {
    overview: Record<string, unknown>;
    dimensions: Record<string, unknown>;
    employmentBySector: unknown;
    employmentByOccupation: unknown;
  };
  education: Record<string, unknown>;
  establishments: Record<string, unknown>;
}

export type AnalyticsLoader = () => Promise<NISRAnalyticsDocument>;

export class AnalyticsUnavailableError extends Error {
  constructor() {
    super("NISR analytics are unavailable. Generate the local aggregate cache first.");
    this.name = "AnalyticsUnavailableError";
  }
}

let cachedAnalytics: Promise<NISRAnalyticsDocument> | undefined;

async function loadNisrAnalytics(): Promise<NISRAnalyticsDocument> {
  if (!cachedAnalytics) {
    const analyticsPath = process.env.NISR_ANALYTICS_PATH
      ? path.resolve(process.env.NISR_ANALYTICS_PATH)
      : path.resolve(__dirname, "../../data/derived/nisr-analytics.json");
    cachedAnalytics = readFile(analyticsPath, "utf-8")
      .then((content) => JSON.parse(content) as NISRAnalyticsDocument)
      .then((document) => {
        if (
          document.schemaVersion !== 1 ||
          !document.labourMarket?.overview ||
          !document.education ||
          !document.establishments
        ) {
          throw new Error("NISR analytics cache has an unsupported schema");
        }
        return document;
      })
      .catch(() => {
        cachedAnalytics = undefined;
        throw new AnalyticsUnavailableError();
      });
  }
  return cachedAnalytics;
}

function sendUnavailable(res: Response): void {
  res.status(503).json({
    success: false,
    error: {
      code: "NISR_ANALYTICS_UNAVAILABLE",
      message: "NISR analytics are unavailable. Generate the local aggregate cache first.",
    },
  });
}

function sendInternalError(res: Response): void {
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to load NISR analytics.",
    },
  });
}

function handleDocument(
  loader: AnalyticsLoader,
  select: (document: NISRAnalyticsDocument) => unknown,
  response: (data: unknown) => unknown,
) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = select(await loader());
      res.status(200).json(response(data));
    } catch (error) {
      if (error instanceof AnalyticsUnavailableError) {
        sendUnavailable(res);
        return;
      }
      sendInternalError(res);
    }
  };
}

/**
 * @openapi
 * /api/v1/analytics/nisr:
 *   get:
 *     summary: Get NISR analytics overview and provenance
 *     tags: [NISR Analytics]
 *     responses:
 *       200:
 *         description: Cached survey overview, source metadata, and methodology.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISROverviewResponse'
 *       503:
 *         description: The local NISR analytics cache has not been generated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 *       500:
 *         description: Unexpected failure while loading the analytics cache.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 */
/**
 * @openapi
 * /api/v1/analytics/nisr/labour-market:
 *   get:
 *     summary: Get weighted labour market indicators and breakdowns
 *     tags: [NISR Analytics]
 *     responses:
 *       200:
 *         description: Employment, unemployment, age, geography, sector, and occupation metrics.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRLabourMarketResponse'
 *       503:
 *         description: The local NISR analytics cache has not been generated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 *       500:
 *         description: Unexpected failure while loading the analytics cache.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 */
/**
 * @openapi
 * /api/v1/analytics/nisr/education:
 *   get:
 *     summary: Get education and TVET distributions
 *     tags: [NISR Analytics]
 *     responses:
 *       200:
 *         description: Education attainment, field, and TVET response distributions.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISREducationResponse'
 *       503:
 *         description: The local NISR analytics cache has not been generated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 *       500:
 *         description: Unexpected failure while loading the analytics cache.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 */
/**
 * @openapi
 * /api/v1/analytics/nisr/establishments:
 *   get:
 *     summary: Get establishment census counts and workforce breakdowns
 *     tags: [NISR Analytics]
 *     responses:
 *       200:
 *         description: Census record counts and unweighted workforce aggregates.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISREstablishmentsResponse'
 *       503:
 *         description: The local NISR analytics cache has not been generated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 *       500:
 *         description: Unexpected failure while loading the analytics cache.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NISRErrorResponse'
 */
export function createNisrAnalyticsRouter(loader: AnalyticsLoader = loadNisrAnalytics): Router {
  const router = Router();

  router.get(
    "/",
    handleDocument(
      loader,
      (document) => ({
        generatedAt: document.generatedAt,
        sources: document.sources,
        methodology: document.methodology,
        overview: document.labourMarket.overview,
        census: {
          sourceYear: document.establishments.sourceYear,
          establishmentRecords: document.establishments.establishmentRecords,
          exactDuplicateRowsRetained: document.establishments.exactDuplicateRowsRetained,
          workforceTotals: document.establishments.workforceTotals,
        },
      }),
      (data) => ({ success: true, data }),
    ),
  );

  router.get(
    "/labour-market",
    handleDocument(
      loader,
      (document) => ({
        source: document.sources.labourForceSurvey,
        methodology: document.methodology.lfs,
        ...document.labourMarket,
      }),
      (data) => ({ success: true, data }),
    ),
  );

  router.get(
    "/education",
    handleDocument(
      loader,
      (document) => ({
        source: document.sources.labourForceSurvey,
        methodology: document.methodology.lfs,
        ...document.education,
      }),
      (data) => ({ success: true, data }),
    ),
  );

  router.get(
    "/establishments",
    handleDocument(
      loader,
      (document) => ({
        source: document.sources.establishmentCensus,
        methodology: document.methodology.establishmentCensus,
        ...document.establishments,
      }),
      (data) => ({ success: true, data }),
    ),
  );

  return router;
}