import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createCatalogueRepository,
  FixtureDataError,
  parseCatalogueDocument,
} from "./fixtureRepository";
import {
  DEADLINE_STATUSES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  VERIFICATION_STATES,
} from "./types";

const cataloguePath = path.resolve(__dirname, "../../data/fixtures/rwanda-opportunity-demo-30.json");

async function readCanonicalDocument(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(cataloguePath, "utf-8")) as Record<string, unknown>;
}

test("repository loads every canonical record without normalizing away source fields", async () => {
  const raw = await readCanonicalDocument();
  const dataset = await createCatalogueRepository().load();
  const opportunities = raw.opportunities as unknown[];
  assert.equal(dataset.opportunities.length, 45);
  assert.deepEqual(dataset.opportunities, opportunities);
  assert.deepEqual(dataset.info.coverage, raw.coverage);
  assert.equal(dataset.declaredOpportunityCount, 30);
  assert.equal(dataset.recordCountMatchesDeclaration, false);
  assert.deepEqual(dataset.duplicateIds, ["rw-example-027"]);
});

test("canonical opportunity and status values are all represented", async () => {
  const dataset = await createCatalogueRepository().load();
  assert.deepEqual([...new Set(dataset.opportunities.map((entry) => entry.type))].sort(), [...OPPORTUNITY_TYPES].sort());
  assert.deepEqual([...new Set(dataset.opportunities.map((entry) => entry.status))].sort(), [...OPPORTUNITY_STATUSES].sort());
  assert.deepEqual([...new Set(dataset.opportunities.map((entry) => entry.deadlineStatus))].sort(), [...DEADLINE_STATUSES].sort());
  assert.deepEqual(
    [...new Set(dataset.opportunities.map((entry) => entry.verification.state))].sort(),
    [...VERIFICATION_STATES].sort(),
  );
  assert.ok(dataset.opportunities.every((entry) => entry.requirements.every((requirement) => typeof requirement === "string")));
  assert.equal(dataset.opportunities.find((entry) => entry.id === "rw-opp-001")?.location?.displayLocation, "Kirehe District, Eastern Province");
});

test("catalogue detects duplicate identifiers without dropping records", async () => {
  const dataset = await createCatalogueRepository().load();
  assert.equal(dataset.opportunities.filter((entry) => entry.id === "rw-example-027").length, 2);
  assert.equal(await createCatalogueRepository().getById("rw-example-027"), undefined);
});

test("malformed catalogue structures and records fail explicitly", async () => {
  assert.throws(() => parseCatalogueDocument({}), FixtureDataError);
  const document = await readCanonicalDocument() as {
    opportunities: Array<Record<string, unknown>>;
  };
  const malformed = structuredClone(document);
  malformed.opportunities[0].type = "unsupported_type";
  assert.throws(() => parseCatalogueDocument(malformed), /type is not a supported catalogue value/);
});

test("missing and unreadable catalogue data fail safely without fallback", async () => {
  const repository = createCatalogueRepository(async () => {
    throw new Error("file missing");
  });
  await assert.rejects(() => repository.load(), FixtureDataError);
  const malformedJsonRepository = createCatalogueRepository(async () => {
    throw new FixtureDataError("Canonical catalogue contains malformed JSON.");
  });
  await assert.rejects(() => malformedJsonRepository.load(), /malformed JSON/);
});
