import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import app from "../app";

async function withServer(callback: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
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

test("public catalogue lists all 48 records and sanitizes internal metadata", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities?limit=100`);
    const body = await response.json() as {
      success: boolean;
      data: {
        opportunities: Array<{ id: string; type: string; title: string; status: string; requirements: unknown[]; metadata?: Record<string, unknown> }>;
        pagination: { total: number; totalPages: number };
        source: { records: number; declaredRecords: number; recordCountMatchesDeclaration: boolean; duplicateIds: string[] };
      };
    };
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.pagination.total, 48);
    assert.equal(body.data.pagination.totalPages, 1);
    assert.equal(body.data.opportunities.length, 48);
    assert.equal(body.data.source.records, 48);
    assert.equal(body.data.source.declaredRecords, 48);
    assert.equal(body.data.source.recordCountMatchesDeclaration, true);
    assert.deepEqual(body.data.source.duplicateIds, []);
    assert.ok(body.data.opportunities.some((item) => item.type === "tvet"));
    assert.ok(body.data.opportunities.some((item) => item.requirements.length > 0));
    assert.equal(body.data.opportunities.filter((item) => item.title.startsWith("DEMO ONLY")).length, 4);
    assert.ok(body.data.opportunities.every((item) =>
      !Object.hasOwn(item.metadata ?? {}, "isSynthetic") &&
      !Object.hasOwn(item.metadata ?? {}, "isLiveOpportunity") &&
      !Object.hasOwn(item.metadata ?? {}, "displaySafety")));
    assert.doesNotMatch(JSON.stringify(body), /"(?:isSynthetic|isLiveOpportunity|displaySafety)"/);
  });
});

test("canonical list filters support catalogue types and status values", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities?type=tvet&status=open`);
    const body = await response.json() as { data: { opportunities: Array<{ type: string; status: string }> } };
    assert.equal(response.status, 200);
    assert.ok(body.data.opportunities.every((entry) => entry.type === "tvet" && entry.status === "open"));

    const deadlineResponse = await fetch(`${baseUrl}/api/v1/opportunities?deadlineStatus=rolling`);
    const deadlineBody = await deadlineResponse.json() as { data: { opportunities: Array<{ deadlineStatus: string }> } };
    assert.equal(deadlineResponse.status, 200);
    assert.ok(deadlineBody.data.opportunities.length > 0);
    assert.ok(deadlineBody.data.opportunities.every((entry) => entry.deadlineStatus === "rolling"));
  });
});

test("catalogue list accepts documented synthetic and live-opportunity filters", async () => {
  await withServer(async (baseUrl) => {
    const publicResponse = await fetch(`${baseUrl}/api/v1/opportunities?limit=100&isSynthetic=false`);
    const publicBody = await publicResponse.json() as { data: { opportunities: unknown[] } };
    assert.equal(publicResponse.status, 200);
    assert.equal(publicBody.data.opportunities.length, 30);

    const syntheticResponse = await fetch(`${baseUrl}/api/v1/opportunities?isSynthetic=true`);
    const syntheticBody = await syntheticResponse.json() as { data: { opportunities: unknown[] } };
    assert.equal(syntheticResponse.status, 200);
    assert.equal(syntheticBody.data.opportunities.length, 18);

    const liveResponse = await fetch(`${baseUrl}/api/v1/opportunities?isLiveOpportunity=true`);
    const liveBody = await liveResponse.json() as {
      data: { opportunities: Array<{ id: string }> };
    };
    assert.equal(liveResponse.status, 200);
    assert.ok(liveBody.data.opportunities.length > 0);
    assert.ok(liveBody.data.opportunities.every((entry) => entry.id.length > 0));

    const invalidResponse = await fetch(`${baseUrl}/api/v1/opportunities?isSynthetic=yes`);
    assert.equal(invalidResponse.status, 400);
  });
});

test("detail route returns synthetic records with demo markers but no internal metadata", async () => {
  await withServer(async (baseUrl) => {
    const retained = await fetch(`${baseUrl}/api/v1/opportunities/rw-example-027`);
    assert.equal(retained.status, 200);
    const removedDuplicate = await fetch(`${baseUrl}/api/v1/opportunities/rw-example-127`);
    assert.equal(removedDuplicate.status, 404);

    const demo = await fetch(`${baseUrl}/api/v1/opportunities/roi-rwanda-public-service-data-officer-demo`);
    const demoBody = await demo.json() as { data: { opportunity: { demonstrationData: boolean; metadata?: Record<string, unknown> } } };
    assert.equal(demo.status, 200);
    assert.equal(demoBody.data.opportunity.demonstrationData, true);

    const unique = await fetch(`${baseUrl}/api/v1/opportunities/rw-opp-001`);
    const uniqueBody = await unique.json() as {
      data: { opportunity: { id: string; demonstrationData: boolean; location: { displayLocation: string }; metadata?: Record<string, unknown> } };
    };
    assert.equal(unique.status, 200);
    assert.equal(uniqueBody.data.opportunity.location.displayLocation, "Kirehe District, Eastern Province");
    assert.equal(Object.hasOwn(uniqueBody.data.opportunity.metadata ?? {}, "isSynthetic"), false);
    assert.equal(Object.hasOwn(uniqueBody.data.opportunity.metadata ?? {}, "isLiveOpportunity"), false);
    assert.equal(Object.hasOwn(uniqueBody.data.opportunity.metadata ?? {}, "displaySafety"), false);
    assert.equal(uniqueBody.data.opportunity.demonstrationData, false);
  });
});

test("eligibility endpoint selects catalogue record and treats prose requirements as unknown", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities/eligibility`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: {}, opportunityId: "rw-opp-001" }),
    });

    test("eligibility demo produces skill gaps and a matched demo training suggestion", async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/opportunities/eligibility`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            opportunityId: "roi-rwanda-public-service-data-officer-demo",
            profile: { skillDisclosure: "complete", skills: [] },
          }),
        });
        const body = await response.json() as {
          data: { eligibility: { outcome: string; explanation: string; assessment: {
            demonstrationData: boolean;
            mandatoryRequirements: { total: number; unmet: number };
            skillGaps: Array<{ name: string; requiredProficiency?: string }>;
            relatedDevelopmentOpportunities: Array<{ title: string; matchedSkills: Array<{ name: string }> }>;
          } } };
        };
        assert.equal(response.status, 200);
        assert.equal(body.data.eligibility.outcome, "ineligible");
        assert.match(body.data.eligibility.explanation, /DEMO ONLY/);
        assert.equal(body.data.eligibility.assessment.demonstrationData, true);
        assert.equal(body.data.eligibility.assessment.mandatoryRequirements.total, 2);
        assert.equal(body.data.eligibility.assessment.mandatoryRequirements.unmet, 2);
        assert.deepEqual(body.data.eligibility.assessment.skillGaps.map((gap) => gap.name), [
          "Spreadsheet analysis",
          "Report writing",
        ]);
        assert.ok(body.data.eligibility.assessment.relatedDevelopmentOpportunities.some((entry) =>
          entry.title.startsWith("DEMO ONLY") &&
          entry.matchedSkills.some((skill) => skill.name === "Spreadsheet analysis")));
      });
    });
    const body = await response.json() as {
      data: {
        eligibility: {
          outcome: string;
          unresolved: Array<{ importance: string; sourceEvidence?: unknown[]; actionToResolve?: string }>;
          assessment: {
            mandatoryRequirements: { total: number; satisfied: number; unmet: number; unresolved: number };
            unclassifiedRequirements: number;
            skillGaps: unknown[];
            skillsNeedingConfirmation: unknown[];
            relatedDevelopmentOpportunities: unknown[];
          };
        };
        opportunity: { id: string };
      };
    };
    assert.equal(response.status, 200);
    assert.equal(body.data.opportunity.id, "rw-opp-001");
    assert.equal(body.data.eligibility.outcome, "eligible");
    assert.ok(body.data.eligibility.unresolved.some((entry) => entry.importance === "unknown"));
    assert.ok(body.data.eligibility.unresolved.some((entry) =>
      entry.sourceEvidence?.length && entry.actionToResolve));
    assert.deepEqual(body.data.eligibility.assessment.mandatoryRequirements, {
      total: 0,
      satisfied: 0,
      unmet: 0,
      unresolved: 0,
    });
    assert.equal(body.data.eligibility.assessment.unclassifiedRequirements, 1);
    assert.deepEqual(body.data.eligibility.assessment.skillGaps, []);
    assert.deepEqual(body.data.eligibility.assessment.skillsNeedingConfirmation, []);
    assert.deepEqual(body.data.eligibility.assessment.relatedDevelopmentOpportunities, []);
  });
});

  test("software and data profile ranks the source-backed coding programme above unrelated records", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: {
          careerGoals: ["software development", "data analysis"],
          skills: [
            { name: "programming", proficiency: "beginner" },
            { name: "data science", proficiency: "beginner" },
            { name: "Android", proficiency: "beginner" },
            { name: "Kotlin", proficiency: "beginner" },
          ],
          skillDisclosure: "complete",
          preferredOpportunityTypes: ["training"],
        } }),
      });
      const body = await response.json() as { data: Array<{ opportunityId: string; suitability: { score: number | null } }> };
      assert.equal(response.status, 200);
      assert.equal(body.data[0]?.opportunityId, "rw-opp-010");
      assert.ok((body.data[0]?.suitability.score ?? 0) > 0);
    });
  });

  test("agriculture profile exposes the real agribusiness internship", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: {
          careerGoals: ["agriculture", "agribusiness"],
          skills: [{ name: "agribusiness", proficiency: "beginner" }],
          skillDisclosure: "complete",
          preferredOpportunityTypes: ["internship"],
        } }),
      });
      const body = await response.json() as { data: Array<{ opportunityId: string }> };
      assert.equal(response.status, 200);
      assert.equal(body.data[0]?.opportunityId, "rw-opp-009");
    });
  });

  test("healthcare profile clearly has no aligned job in the current catalogue", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "job", includeNeedsConfirmation: true, profile: {
          careerGoals: ["healthcare", "nursing"],
        } }),
      });
      const body = await response.json() as {
        data: Array<{
          opportunity: { type: string };
          suitability: { components: Array<{ factor: string; score: number | null }> };
        }>;
      };
      assert.equal(response.status, 200);
      assert.equal(body.data.filter((result) =>
        result.suitability.components.find((component) => component.factor === "careerAlignment")?.score &&
        result.suitability.components.find((component) => component.factor === "careerAlignment")!.score! > 0).length, 0);
    });
  });

  test("entrepreneurship profile identifies both real business-support records", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: {
          careerGoals: ["entrepreneurship", "business development"],
          interests: ["startup", "small business"],
          interestDisclosure: "complete",
        } }),
      });
      const body = await response.json() as { data: Array<{ opportunityId: string }> };
      assert.equal(response.status, 200);
      const ids = body.data.map((result) => result.opportunityId);
      assert.ok(ids.includes("rw-opp-029"));
      assert.ok(ids.includes("rw-opp-030"));
    });
  });

  test("graduate profile finds real internship pathways and includes explanatory guidance", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: {
          careerGoals: ["graduate career development"],
          qualifications: [{ name: "Bachelor's degree", level: "bachelor", fieldOfStudy: "business" }],
          qualificationDisclosure: "complete",
          workExperience: [],
          workExperienceDisclosure: "complete",
          preferredOpportunityTypes: ["internship", "training"],
        } }),
      });
      const body = await response.json() as {
        data: Array<{ opportunityId: string; guidance: { action: string; nextStep: string; supportingOpportunityIds: string[] } }>;
      };
      assert.equal(response.status, 200);
      const ids = body.data.map((result) => result.opportunityId);
      assert.ok(ids.includes("rw-opp-007") || ids.includes("rw-opp-008"));
      assert.ok(body.data.every((result) => result.guidance.nextStep.length > 0));
    });
  });

test("matching excludes synthetic, closed, and needs-confirmation entries by default", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { skills: [{ name: "teacher" }] } }),
    });
    const body = await response.json() as {
      data: Array<{ opportunityId: string; eligibility: { outcome: string }; opportunity: { status: string; metadata: { isSynthetic: boolean }; verification: { state: string } } }>;
    };
    assert.equal(response.status, 200);
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every((entry) =>
      !entry.opportunity.metadata.isSynthetic &&
      entry.opportunity.status !== "closed" &&
      entry.opportunity.verification.state !== "needs_confirmation"));
    assert.ok(body.data.every((entry) => typeof entry.eligibility.outcome === "string"));
  });
});

test("synthetic matching remains supported without exposing internal metadata", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: {}, includeSynthetic: true, includeClosed: true, includeNeedsConfirmation: true }),
    });
    const body = await response.json() as { data: Array<{ opportunity: { status: string; metadata?: Record<string, unknown> } }> };
    assert.equal(response.status, 200);
    assert.ok(body.data.some((entry) => entry.opportunity.status === "synthetic_example"));
    assert.ok(body.data.every((entry) =>
      !Object.hasOwn(entry.opportunity.metadata ?? {}, "isSynthetic") &&
      !Object.hasOwn(entry.opportunity.metadata ?? {}, "isLiveOpportunity") &&
      !Object.hasOwn(entry.opportunity.metadata ?? {}, "displaySafety")));
    assert.doesNotMatch(JSON.stringify(body), /"(?:isSynthetic|isLiveOpportunity|displaySafety)"/);
  });
});

test("source response lists only catalogue-observed providers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities/sources`);
    const body = await response.json() as { data: { sources: Array<{ id: string; status: string }> } };
    assert.equal(response.status, 200);
    assert.ok(body.data.sources.length > 0);
    assert.ok(body.data.sources.every((source) => source.status === "catalogued"));
    assert.equal(body.data.sources.some((source) => source.id === "himalayas"), false);
  });
});

test("caller-supplied opportunity arrays are explicitly rejected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/opportunities/match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: {}, opportunities: [] }),
    });
    assert.equal(response.status, 400);
  });
});

test("invalid query parameters and unknown records return explicit errors", async () => {
  await withServer(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/v1/opportunities?type=nonexistent`);
    assert.equal(invalid.status, 400);
    const missing = await fetch(`${baseUrl}/api/v1/opportunities/not-present`);
    assert.equal(missing.status, 404);
  });
});

test("Swagger documents canonical types, statuses, and existing opportunity routes", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api-docs/swagger-ui-init.js`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /business_support/);
    assert.match(body, /rolling_example/);
    assert.match(body, /verified_listing/);
    assert.match(body, /\/api\/v1\/opportunities\/eligibility/);
    assert.match(body, /\/api\/v1\/opportunities\/match/);
    assert.match(body, /EligibilityAssessment/);
    assert.match(body, /skillsNeedingConfirmation/);
    assert.doesNotMatch(body, /demo-rw-001/);
  });
});
