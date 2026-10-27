import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEligibility, validateOpportunity } from "./eligibility";
import { DEFAULT_MATCHING_WEIGHTS, matchOpportunity, rankOpportunities } from "./matching";
import { Opportunity, OpportunityRequirement, UserProfile } from "./types";

const fixtureEvidence = {
  kind: "source_listing" as const,
  description: "Labelled local test fixture; not a real opportunity.",
};

function fixtureOpportunity(
  overrides: Partial<Opportunity> = {},
  requirements: OpportunityRequirement[] = [],
): Opportunity {
  return {
    id: "fixture-opportunity-a",
    type: "internship",
    title: "Fixture Data Internship",
    organization: { name: "Fixture Organization" },
    source: {
      id: "fixture-source",
      name: "Local Fixture Source",
      attribution: "Synthetic test fixture only",
    },
    provenance: [
      { field: "title", sourceId: "fixture-source", certainty: "known", evidence: [fixtureEvidence] },
    ],
    applicationUrl: "https://opportunity.example.test/apply",
    status: "open",
    deadlineStatus: "confirmed",
    requirements,
    suitabilitySignals: { interests: [{ value: "data", evidence: [fixtureEvidence] }] },
    costAndFunding: { cost: "not stated", costCertainty: "not_stated", fundingCertainty: "not_stated" },
    verification: { state: "verified_listing" },
    metadata: { isSynthetic: false, isLiveOpportunity: true, category: "data" },
    mandatoryRequirementsDisclosure: "complete",
    ...overrides,
  } as Opportunity;
}

const pythonRequirement: OpportunityRequirement = {
  id: "python-skill",
  description: "Demonstrate intermediate Python skills.",
  importance: "mandatory",
  certainty: "known",
  criterion: { kind: "skill", name: "Python", minimumProficiency: "intermediate" },
  evidence: [fixtureEvidence],
};

const degreeRequirement: OpportunityRequirement = {
  id: "accepted-education",
  description: "Have a listed bachelor's qualification.",
  importance: "mandatory",
  certainty: "known",
  criterion: { kind: "education", acceptedLevels: ["bachelor"] },
  evidence: [fixtureEvidence],
};

const profileWithQualifications: UserProfile = {
  skills: [{ name: "Python", proficiency: "advanced", evidence: [{ kind: "project", description: "Fixture project evidence." }] }],
  skillDisclosure: "complete",
  qualifications: [{ name: "Fixture bachelor's degree", level: "bachelor" }],
  qualificationDisclosure: "complete",
  preferredOpportunityTypes: ["internship"],
};

test("all documented mandatory requirements satisfied returns eligible", () => {
  const result = evaluateEligibility(profileWithQualifications, fixtureOpportunity({}, [pythonRequirement, degreeRequirement]));
  assert.equal(result.outcome, "eligible");
  assert.equal(result.satisfied.length, 2);
  assert.equal(result.unmet.length, 0);
  assert.equal(result.unresolved.length, 0);
});

test("a documented mandatory requirement not satisfied returns ineligible", () => {
  const result = evaluateEligibility({ ...profileWithQualifications, age: 20 }, fixtureOpportunity({}, [
    { ...pythonRequirement, criterion: { kind: "minimum_age", years: 30 } },
  ]));
  assert.equal(result.outcome, "ineligible");
  assert.equal(result.unmet.length, 1);
});

test("an unresolved mandatory requirement returns unknown", () => {
  const unresolved: OpportunityRequirement = {
    id: "unknown-citizenship",
    description: "Citizenship requirement is unclear.",
    importance: "mandatory",
    certainty: "unknown",
  };
  const result = evaluateEligibility(profileWithQualifications, fixtureOpportunity({}, [unresolved]));
  assert.equal(result.outcome, "unknown");
  assert.equal(result.unresolved[0].status, "unresolved");
});

test("missing experience-area details remain unresolved rather than becoming an unmet requirement", () => {
  const requirement: OpportunityRequirement = {
    id: "agriculture-experience",
    description: "At least two years of agricultural experience.",
    importance: "mandatory",
    certainty: "known",
    criterion: { kind: "minimum_experience", years: 2, relatedArea: "agriculture" },
    evidence: [fixtureEvidence],
  };
  const result = evaluateEligibility({
    workExperience: [{ role: "Project Officer", years: 3 }],
    workExperienceDisclosure: "complete",
  }, fixtureOpportunity({}, [requirement]));
  assert.equal(result.outcome, "unknown");
  assert.equal(result.unmet.length, 0);
  assert.match(result.unresolved[0].explanation, /areas/i);
});

test("one unmet mandatory requirement takes precedence over other unknown requirements", () => {
  const result = evaluateEligibility({ ...profileWithQualifications, age: 20 }, fixtureOpportunity({}, [
    {
      ...pythonRequirement,
      criterion: { kind: "minimum_age", years: 30 },
    },
    {
      id: "unclear-residence",
      description: "Residence rule not stated by source.",
      importance: "mandatory",
      certainty: "not_stated",
    },
  ]));
  assert.equal(result.outcome, "ineligible");
  assert.equal(result.unresolved.length, 1);
});

test("no mandatory requirements can be eligible only when disclosure is complete", () => {
  assert.equal(evaluateEligibility({}, fixtureOpportunity()).outcome, "eligible");
  assert.equal(evaluateEligibility({}, fixtureOpportunity({ mandatoryRequirementsDisclosure: "partial" })).outcome, "unknown");
});

test("no formal qualifications does not throw and evaluates a degree requirement honestly", () => {
  const profile: UserProfile = { qualifications: [], qualificationDisclosure: "complete" };
  const result = evaluateEligibility(profile, fixtureOpportunity({}, [degreeRequirement]));
  assert.equal(result.outcome, "ineligible");
  assert.match(result.unmet[0].explanation, /complete qualification history/i);
});

test("a profile with no skills or interests remains rankable without a fabricated score", () => {
  const result = matchOpportunity({}, fixtureOpportunity());
  assert.equal(result.suitability.score, null);
  assert.equal(result.eligibility.outcome, "eligible");
  assert.equal(result.suitability.components.length, 8);
});

test("partial profile information remains unresolved rather than being treated as failure", () => {
  const result = evaluateEligibility({ skills: [], skillDisclosure: "partial" }, fixtureOpportunity({}, [pythonRequirement]));
  assert.equal(result.outcome, "unknown");
  assert.equal(result.unmet.length, 0);
  assert.match(result.unresolved[0].explanation, /not listed/i);
});

test("suitability exposes weighted components and penalizes sparse evidence coverage", () => {
  const opportunity = fixtureOpportunity({}, [
    { ...pythonRequirement, importance: "preferred" },
  ]);
  const profile: UserProfile = {
    skills: [{ name: "Python", proficiency: "advanced" }],
    skillDisclosure: "partial",
    interests: ["data"],
    interestDisclosure: "complete",
    preferredOpportunityTypes: ["internship"],
  };
  const result = matchOpportunity(profile, opportunity);
  assert.equal(result.suitability.score, 45);
  assert.equal(result.suitability.components.find((component) => component.factor === "skills")?.weight, DEFAULT_MATCHING_WEIGHTS.skills);
  assert.equal(result.suitability.components.find((component) => component.factor === "skills")?.score, 100);
  assert.equal(result.suitability.evidenceCoveragePercent, 45);
  assert.match(result.suitability.scoreMeaning, /unavailable evidence earns no positive points/i);
  assert.match(result.suitability.scoreMeaning, /not a probability/i);
});

test("career-family overlap does not incorrectly count as a matching technical skill", () => {
  const opportunity = fixtureOpportunity({
    suitabilitySignals: { skills: [{ name: "Python", evidence: [fixtureEvidence] }] },
  });
  const result = matchOpportunity({ skills: [{ name: "programming" }], skillDisclosure: "complete" }, opportunity);
  assert.equal(result.suitability.components.find((component) => component.factor === "skills")?.score, 0);
});

test("identical inputs produce deterministic ranking with stable ID tie-breaks", () => {
  const profile: UserProfile = { preferredOpportunityTypes: ["internship"] };
  const opportunities = [
    fixtureOpportunity({ id: "fixture-b", deduplicationKey: "fixture-b" }),
    fixtureOpportunity({ id: "fixture-a", deduplicationKey: "fixture-a" }),
  ];
  const first = rankOpportunities(profile, opportunities).map((item) => item.opportunityId);
  const second = rankOpportunities(profile, opportunities).map((item) => item.opportunityId);
  assert.deepEqual(first, ["fixture-a", "fixture-b"]);
  assert.deepEqual(first, second);
});

test("eligibility remains separate from a high suitability score", () => {
  const opportunity = fixtureOpportunity({}, [
    { ...pythonRequirement, criterion: { kind: "minimum_age", years: 40 } },
    { ...pythonRequirement, id: "preferred-python", importance: "preferred" },
  ]);
  const result = matchOpportunity({
    age: 20,
    skills: [{ name: "Python", proficiency: "advanced" }],
    skillDisclosure: "complete",
    preferredOpportunityTypes: ["internship"],
  }, opportunity);
  assert.equal(result.eligibility.outcome, "ineligible");
  assert.equal(result.suitability.score, 35);
});

test("invalid or incomplete opportunity data is rejected", () => {
  const invalid = validateOpportunity({
    id: "",
    type: "job",
    title: "",
    applicationUrl: "javascript:alert(1)",
    requirements: [{ importance: "mandatory", certainty: "known" }],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 5);
  assert.throws(() => matchOpportunity({}, invalid as unknown as Opportunity), /Invalid opportunity/);
});

test("matching weights are configurable and invalid totals are rejected", () => {
  const result = matchOpportunity({ preferredOpportunityTypes: ["internship"] }, fixtureOpportunity(), {
    skills: 0,
    interests: 0,
    locationAndWorkMode: 0,
    opportunityType: 2,
  });
  assert.equal(result.suitability.score, 80.97);
  assert.throws(() => matchOpportunity({}, fixtureOpportunity(), {
    skills: 0,
    interests: 0,
    locationAndWorkMode: 0,
    opportunityType: 0,
  }), /positive total/i);
});

test("prose catalogue requirements remain unknown rather than being treated as satisfied", () => {
  const opportunity = fixtureOpportunity({
    requirements: ["Must meet the official job profile and public-service recruitment requirements."],
  });
  const result = evaluateEligibility({}, opportunity);
  assert.equal(result.outcome, "unknown");
  assert.equal(result.unresolved[0].importance, "unknown");
});

test("non-live status is not treated as synthetic", () => {
  const opportunity = fixtureOpportunity({
    metadata: { isSynthetic: false, isLiveOpportunity: false },
  });
  const eligibility = evaluateEligibility({}, opportunity);
  const match = matchOpportunity({}, opportunity);
  assert.equal(eligibility.unresolved.some((item) => item.requirementId === "synthetic-fixture"), false);
  assert.doesNotMatch(match.suitability.scoreMeaning, /synthetic demo data/i);
});