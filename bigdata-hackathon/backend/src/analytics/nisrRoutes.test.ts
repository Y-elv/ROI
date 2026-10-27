import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import app from "../app";
import {
  AnalyticsUnavailableError,
  createNisrAnalyticsRouter,
} from "./nisrRoutes";

async function withServer(
  application: express.Express,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = application.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("health endpoint remains available", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json() as { success: boolean; message: string };
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "API is healthy.");
  });
});

test("Swagger UI serves the NISR route definitions", async () => {
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api-docs/swagger-ui-init.js`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /\/api\/v1\/analytics\/nisr\/labour-market/);
    assert.match(body, /\/api\/v1\/analytics\/nisr\/establishments/);
  });
});

test("NISR endpoints return cached source data and methodology", async () => {
  await withServer(app, async (baseUrl) => {
    const overviewResponse = await fetch(`${baseUrl}/api/v1/analytics/nisr`);
    const overview = await overviewResponse.json() as {
      success: boolean;
      data: { overview: Record<string, { value?: number; denominator?: string }>; sources: Record<string, { sourceYear: number }> };
    };
    assert.equal(overviewResponse.status, 200);
    assert.equal(overview.success, true);
    assert.equal(overview.data.sources.labourForceSurvey.sourceYear, 2025);
    assert.equal(typeof overview.data.overview.unemploymentRate.value, "number");
    assert.equal(overview.data.overview.unemploymentRate.denominator, "Labour force age 16 and older");

    const labourResponse = await fetch(`${baseUrl}/api/v1/analytics/nisr/labour-market`);
    const labour = await labourResponse.json() as {
      success: boolean;
      data: { dimensions: Record<string, unknown[]>; employmentBySector: { categories: unknown[] } };
    };
    assert.equal(labourResponse.status, 200);
    assert.equal(labour.success, true);
    assert.equal(labour.data.dimensions.district.length, 30);
    assert.equal("sector" in labour.data.dimensions, false);
    assert.ok(labour.data.employmentBySector.categories.length > 0);

    const educationResponse = await fetch(`${baseUrl}/api/v1/analytics/nisr/education`);
    const education = await educationResponse.json() as {
      success: boolean;
      data: { distributions: Record<string, { categories: unknown[] }> };
    };
    assert.equal(educationResponse.status, 200);
    assert.equal(education.success, true);
    assert.equal(education.data.distributions.everLearnedTVET.categories.length, 2);

    const censusResponse = await fetch(`${baseUrl}/api/v1/analytics/nisr/establishments`);
    const census = await censusResponse.json() as {
      success: boolean;
      data: { source: { sourceYear: number }; exactDuplicateRowsRetained: number };
    };
    assert.equal(censusResponse.status, 200);
    assert.equal(census.success, true);
    assert.equal(census.data.source.sourceYear, 2023);
    assert.equal(census.data.exactDuplicateRowsRetained, 17103);
  });
});

test("missing analytics cache returns consistent 503 error", async () => {
  const application = express();
  application.use("/api/v1/analytics/nisr", createNisrAnalyticsRouter(async () => {
    throw new AnalyticsUnavailableError();
  }));
  await withServer(application, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/analytics/nisr`);
    const body = await response.json() as { success: boolean; error: { code: string } };
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "NISR_ANALYTICS_UNAVAILABLE");
  });
});

test("unexpected analytics failure returns consistent 500 error", async () => {
  const application = express();
  application.use("/api/v1/analytics/nisr", createNisrAnalyticsRouter(async () => {
    throw new Error("fixture failure");
  }));
  await withServer(application, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/analytics/nisr`);
    const body = await response.json() as { success: boolean; error: { code: string } };
    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INTERNAL_SERVER_ERROR");
  });
});