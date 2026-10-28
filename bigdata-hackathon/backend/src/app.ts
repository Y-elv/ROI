
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { createNisrAnalyticsRouter } from "./analytics/nisrRoutes";
import { createCvRouter } from "./cv/cvRoutes";
import { createOpportunityRouter } from "./opportunities/opportunityRoutes";

const app = express();

const allowedOrigins = [
  "https://roi-rwanda.web.app",
  "http://localhost:5173",
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: "100kb" }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Rwanda Opportunity Intelligence API",
      version: "1.0.0",
      description: "NISR analytics and evidence-based opportunity eligibility and suitability evaluation.",
    },
    components: {
      schemas: {
        OpportunityEvidence: {
          type: "object",
          required: ["kind", "description"],
          properties: {
            kind: { type: "string", enum: ["self_reported", "self_taught", "document", "project", "portfolio", "work", "assessment", "source_listing", "other"] },
            description: { type: "string" },
            uri: { type: "string", format: "uri" },
            observedAt: { type: "string", format: "date-time" },
            verified: { type: "boolean" },
          },
        },
        OpportunityProfile: {
          type: "object",
          description: "Partial profiles are allowed. Omitted fields remain unknown and are not treated as negative facts.",
          properties: {
            age: { type: "number", minimum: 0 },
            internetAccess: { type: "string", enum: ["reliable", "limited", "none", "unknown"] },
            residenceCountryCode: { type: "string" },
            citizenshipCountryCodes: { type: "array", items: { type: "string" } },
            workAuthorizationCountryCodes: { type: "array", items: { type: "string" } },
            countryDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            qualifications: { type: "array", items: { $ref: "#/components/schemas/ProfileQualification" } },
            qualificationDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            skills: { type: "array", items: { $ref: "#/components/schemas/ProfileSkill" } },
            skillDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            projects: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" }, skillNames: { type: "array", items: { type: "string" } }, uri: { type: "string", format: "uri" } } } },
            workExperience: { type: "array", items: { type: "object", required: ["role", "years"], properties: { role: { type: "string" }, years: { type: "number", minimum: 0 }, areas: { type: "array", items: { type: "string" } } } } },
            workExperienceDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            certifications: { type: "array", items: { $ref: "#/components/schemas/ProfileQualification" } },
            certificationDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            interests: { type: "array", items: { type: "string" } },
            interestDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            preferredCountryCodes: { type: "array", items: { type: "string" } },
            preferredWorkModes: { type: "array", items: { type: "string", enum: ["onsite", "in_person", "hybrid", "remote", "unspecified"] } },
            preferredOpportunityTypes: { type: "array", items: { $ref: "#/components/schemas/OpportunityType" } },
            careerGoals: { type: "array", items: { type: "string" } },
            preferredCategories: { type: "array", items: { type: "string" } },
            preferredLocations: { type: "array", items: { type: "string" } },
            facts: { type: "object", additionalProperties: { type: "object" } },
          },
        },
        ProfileQualification: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            level: { type: "string", description: "Source-stated education label; equivalencies are not inferred." },
            fieldOfStudy: { type: "string" },
            institution: { type: "string" },
            completedAt: { type: "string", format: "date" },
            evidence: { type: "array", items: { $ref: "#/components/schemas/OpportunityEvidence" } },
          },
        },
        ProfileSkill: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            proficiency: { type: "string", enum: ["beginner", "intermediate", "advanced", "expert"] },
            evidence: { type: "array", items: { $ref: "#/components/schemas/OpportunityEvidence" } },
          },
        },
        ProficiencyLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced", "expert"],
        },
        OpportunityType: {
          type: "string",
          enum: ["job", "internship", "apprenticeship", "scholarship", "training", "entrepreneurship", "business_support", "certification", "education", "industrial_placement", "livelihoods", "study_loan", "tvet"],
          example: "job",
        },
        OpportunityStatus: {
          type: "string",
          enum: ["open", "closed", "rolling", "needs_confirmation", "rolling_example", "synthetic_example"],
        },
        DeadlineStatus: { type: "string", enum: ["confirmed", "historical", "not_confirmed", "rolling"] },
        VerificationState: { type: "string", enum: ["verified_listing", "needs_confirmation", "synthetic"] },
        OpportunityRequirement: {
          oneOf: [
            { type: "string", example: "Must meet the official job profile and public-service recruitment requirements." },
            {
              type: "object",
              required: ["id", "description", "importance", "certainty"],
              properties: {
                id: { type: "string" },
                description: { type: "string" },
                importance: { type: "string", enum: ["mandatory", "preferred", "unknown"] },
                certainty: { type: "string", enum: ["known", "unknown", "not_stated"] },
                criterion: { type: "object" },
                evidence: { type: "array", items: { $ref: "#/components/schemas/OpportunityEvidence" } },
              },
            },
          ],
        },
        Opportunity: {
          type: "object",
          required: ["id", "type", "title", "organization", "source", "status", "deadlineStatus", "requirements", "costAndFunding", "verification"],
          additionalProperties: true,
          properties: {
            id: { type: "string", example: "rw-opp-001" },
            type: { $ref: "#/components/schemas/OpportunityType" },
            title: { type: "string", example: "Urban and Economic Development Officer" },
            organization: {
              type: "object", required: ["name"], additionalProperties: true,
              properties: { name: { type: "string" }, kind: { type: "string", nullable: true } },
            },
            description: { type: "string" },
            location: {
              type: "object", nullable: true, additionalProperties: true,
              properties: {
                country: { type: "string", nullable: true }, province: { type: "string", nullable: true },
                district: { type: "string", nullable: true }, displayLocation: { type: "string", nullable: true },
                workMode: { type: "string", nullable: true, example: "in_person" },
              },
            },
            source: {
              type: "object", required: ["id", "name"], additionalProperties: true,
              properties: {
                id: { type: "string" }, name: { type: "string" },
                url: { type: "string", format: "uri", nullable: true }, attribution: { type: "string", nullable: true },
              },
            },
            applicationUrl: { type: "string", format: "uri", nullable: true, example: "https://recruitment.mifotra.gov.rw/" },
            deadline: { type: "string", format: "date", nullable: true, example: "2026-10-30" },
            deadlineStatus: { $ref: "#/components/schemas/DeadlineStatus" },
            status: { $ref: "#/components/schemas/OpportunityStatus" },
            duration: { type: "string", nullable: true },
            costAndFunding: {
              type: "object", additionalProperties: true,
              properties: {
                cost: { type: "string", nullable: true }, costCertainty: { type: "string", nullable: true },
                benefits: { type: "array", nullable: true, items: { type: "string" } },
                fundingCertainty: { type: "string", nullable: true },
              },
            },
            requirements: { type: "array", items: { $ref: "#/components/schemas/OpportunityRequirement" } },
            suitabilitySignals: { type: "object", nullable: true },
            careerFamilies: { type: "array", items: { type: "object" } },
            provenance: { type: "array", items: { type: "object" } },
            mandatoryRequirementsDisclosure: { type: "string", enum: ["complete", "partial", "unknown"] },
            verification: {
              type: "object", required: ["state"], additionalProperties: true,
              properties: {
                state: { $ref: "#/components/schemas/VerificationState" },
                lastVerifiedAt: { type: "string", format: "date", nullable: true },
                verificationNote: { type: "string", nullable: true },
              },
            },
            metadata: {
              type: "object", nullable: true, additionalProperties: true,
              properties: {
                category: { type: "string" }, asOf: { type: "string", format: "date", nullable: true },
              },
            },
          },
        },
        CatalogueSummary: {
          type: "object",
          required: ["id", "name", "version", "warning", "records", "declaredRecords", "recordCountMatchesDeclaration", "duplicateIds"],
          properties: {
            id: { type: "string" }, name: { type: "string" }, version: { type: "string" },
            asOf: { type: "string", nullable: true }, warning: { type: "string" },
            records: { type: "integer" }, declaredRecords: { type: "integer", nullable: true },
            recordCountMatchesDeclaration: { type: "boolean", nullable: true },
            duplicateIds: { type: "array", items: { type: "string" } },
          },
        },
        OpportunityEligibilityRequest: {
          type: "object", required: ["profile", "opportunityId"],
          description: "Selects a record by ID from the canonical catalogue. useDemoFixtures is accepted as a compatibility alias and does not change the data source.",
          properties: {
            profile: { $ref: "#/components/schemas/OpportunityProfile" },
            opportunityId: { type: "string", example: "rw-opp-001" },
            useDemoFixtures: { type: "boolean", deprecated: true },
          },
        },
        OpportunityMatchRequest: {
          type: "object", required: ["profile"],
          description: "Matches against the canonical catalogue; caller-supplied opportunity arrays are no longer supported.",
          properties: {
            profile: { $ref: "#/components/schemas/OpportunityProfile" },
            type: { $ref: "#/components/schemas/OpportunityType" },
            category: { type: "string" },
            status: { $ref: "#/components/schemas/OpportunityStatus" },
            includeSynthetic: { type: "boolean", default: false },
            includeClosed: { type: "boolean", default: false },
            includeNeedsConfirmation: { type: "boolean", default: false },
            useDemoFixtures: { type: "boolean", deprecated: true, description: "Compatibility alias for includeSynthetic." },
            weights: { type: "object", properties: {
              skills: { type: "number", minimum: 0 }, interests: { type: "number", minimum: 0 },
              locationAndWorkMode: { type: "number", minimum: 0 }, opportunityType: { type: "number", minimum: 0 },
              profileAlignment: { type: "number", minimum: 0 },
              careerAlignment: { type: "number", minimum: 0 }, education: { type: "number", minimum: 0 },
              experience: { type: "number", minimum: 0 },
            } },
          },
        },
        RequirementEvaluation: {
          type: "object",
          required: ["requirementId", "description", "importance", "status", "explanation"],
          properties: {
            requirementId: { type: "string" }, description: { type: "string" },
            importance: { type: "string", enum: ["mandatory", "preferred", "unknown"] },
            status: { type: "string", enum: ["satisfied", "unmet", "unresolved"] }, explanation: { type: "string" },
            sourceEvidence: { type: "array", items: { $ref: "#/components/schemas/OpportunityEvidence" } },
            profileEvidence: { type: "array", items: { type: "string" } },
            actionToResolve: { type: "string" },
          },
        },
        SkillRequirementAssessment: {
          type: "object",
          required: ["requirementId", "name"],
          description: "A skill tied to a known structured skill criterion. Only mandatory unmet skills appear in skillGaps.",
          properties: {
            requirementId: { type: "string" },
            name: { type: "string" },
            requiredProficiency: { $ref: "#/components/schemas/ProficiencyLevel" },
            profileProficiency: { $ref: "#/components/schemas/ProficiencyLevel" },
          },
        },
        EligibilityAssessment: {
          type: "object",
          required: [
            "mandatoryRequirements",
            "unclassifiedRequirements",
            "preferredRequirements",
            "skillGaps",
            "skillsNeedingConfirmation",
            "relatedDevelopmentOpportunities",
          ],
          description: "Summary counts concern catalogue-declared mandatory requirements; skill gaps exclude unknown, preferred, and unclassified criteria.",
          properties: {
            mandatoryRequirements: {
              type: "object",
              required: ["total", "satisfied", "unmet", "unresolved"],
              properties: {
                total: { type: "integer", minimum: 0 },
                satisfied: { type: "integer", minimum: 0 },
                unmet: { type: "integer", minimum: 0 },
                unresolved: { type: "integer", minimum: 0 },
              },
            },
            unclassifiedRequirements: { type: "integer", minimum: 0 },
            preferredRequirements: { type: "integer", minimum: 0 },
            mandatoryRequirementsDisclosure: {
              type: "string",
              enum: ["complete", "partial", "unknown"],
            },
            skillGaps: { type: "array", items: { $ref: "#/components/schemas/SkillRequirementAssessment" } },
            skillsNeedingConfirmation: { type: "array", items: { $ref: "#/components/schemas/SkillRequirementAssessment" } },
            relatedDevelopmentOpportunities: {
              type: "array",
              description: "Verified, non-synthetic, open/rolling training records with an evidenced learning outcome matching a known mandatory skill gap.",
              items: { $ref: "#/components/schemas/SkillDevelopmentOpportunity" },
            },
          },
        },
        SkillDevelopmentOpportunity: {
          type: "object",
          required: ["opportunityId", "title", "organization", "type", "status", "deadlineStatus", "source", "matchedSkills"],
          properties: {
            opportunityId: { type: "string" },
            title: { type: "string" },
            organization: { type: "string" },
            type: { $ref: "#/components/schemas/OpportunityType" },
            status: { $ref: "#/components/schemas/OpportunityStatus" },
            deadlineStatus: { $ref: "#/components/schemas/DeadlineStatus" },
            applicationUrl: { type: "string", format: "uri", nullable: true },
            source: {
              type: "object",
              required: ["name"],
              properties: { name: { type: "string" }, url: { type: "string", format: "uri", nullable: true } },
            },
            matchedSkills: {
              type: "array",
              items: {
                type: "object",
                required: ["requirementId", "name", "evidence"],
                properties: {
                  requirementId: { type: "string" },
                  name: { type: "string" },
                  evidence: { type: "array", items: { $ref: "#/components/schemas/OpportunityEvidence" } },
                },
              },
            },
          },
        },
        EligibilityResult: {
          type: "object", required: ["outcome", "explanation", "assessment", "satisfied", "unmet", "unresolved", "preferred"],
          properties: {
            outcome: { type: "string", enum: ["eligible", "ineligible", "unknown"] }, explanation: { type: "string" },
            assessment: { $ref: "#/components/schemas/EligibilityAssessment" },
            satisfied: { type: "array", items: { $ref: "#/components/schemas/RequirementEvaluation" } },
            unmet: { type: "array", items: { $ref: "#/components/schemas/RequirementEvaluation" } },
            unresolved: { type: "array", items: { $ref: "#/components/schemas/RequirementEvaluation" } },
            preferred: { type: "array", items: { $ref: "#/components/schemas/RequirementEvaluation" } },
          },
        },
        SuitabilityComponent: {
          type: "object",
          required: ["factor", "weight", "score", "explanation", "matchedEvidence", "nonMatchingEvidence", "unresolvedEvidence"],
          properties: {
            factor: { type: "string", enum: ["skills", "interests", "locationAndWorkMode", "opportunityType", "profileAlignment", "careerAlignment", "education", "experience"] },
            weight: { type: "number" }, score: { type: "number", nullable: true, minimum: 0, maximum: 100 },
            explanation: { type: "string" }, matchedEvidence: { type: "array", items: { type: "string" } },
            nonMatchingEvidence: { type: "array", items: { type: "string" } },
            unresolvedEvidence: { type: "array", items: { type: "string" } },
          },
        },
        RecommendationResult: {
          type: "object",
          required: ["opportunityId", "title", "organization", "opportunity", "eligibility", "guidance", "suitability"],
          properties: {
            opportunityId: { type: "string" }, title: { type: "string" }, organization: { type: "string" },
            applicationUrl: { type: "string", format: "uri", nullable: true },
            opportunity: { $ref: "#/components/schemas/Opportunity" },
            eligibility: { $ref: "#/components/schemas/EligibilityResult" },
            guidance: { type: "object", required: ["action", "reasons", "gaps", "nextStep", "targetOutcome", "supportingOpportunityIds", "uncertainty"], properties: {
              action: { type: "string", enum: ["consider_applying", "apply_with_gaps", "build_experience_first", "build_skills_first", "pursue_training_or_certification", "explore_further_study", "insufficient_information"] },
              reasons: { type: "array", items: { type: "string" } }, gaps: { type: "array", items: { type: "string" } },
              nextStep: { type: "string" }, targetOutcome: { type: "string" },
              supportingOpportunityIds: { type: "array", items: { type: "string" } }, uncertainty: { type: "array", items: { type: "string" } },
            } },
            suitability: { type: "object", required: ["score", "scoreMeaning", "evidenceCoveragePercent", "components"], properties: {
              score: { type: "number", nullable: true, minimum: 0, maximum: 100, description: "Conservative weighted suitability score; unavailable evidence earns no positive points but is marked unknown, not a mismatch." },
              scoreMeaning: { type: "string" },
              evidenceCoveragePercent: { type: "number", minimum: 0, maximum: 100 },
              components: { type: "array", items: { $ref: "#/components/schemas/SuitabilityComponent" } },
            } },
          },
        },
        OpportunityEligibilityResponse: {
          type: "object", required: ["success", "data"],
          properties: { success: { type: "boolean", enum: [true] }, data: { type: "object", required: ["opportunityId", "eligibility", "opportunity", "source"], properties: { opportunityId: { type: "string" }, eligibility: { $ref: "#/components/schemas/EligibilityResult" }, opportunity: { $ref: "#/components/schemas/Opportunity" }, source: { $ref: "#/components/schemas/CatalogueSummary" } } } },
        },
        OpportunityMatchResponse: {
          type: "object", required: ["success", "data", "source"],
          properties: { success: { type: "boolean", enum: [true] }, data: { type: "array", items: { $ref: "#/components/schemas/RecommendationResult" } }, source: { $ref: "#/components/schemas/CatalogueSummary" } },
        },
        OpportunityListResponse: {
          type: "object", required: ["success", "data"],
          properties: { success: { type: "boolean", enum: [true] }, data: { type: "object", required: ["opportunities", "pagination", "source"], properties: {
            opportunities: { type: "array", items: { $ref: "#/components/schemas/Opportunity" } },
            pagination: { type: "object", required: ["page", "limit", "total", "totalPages"], properties: {
              page: { type: "integer" }, limit: { type: "integer", maximum: 100 },
              total: { type: "integer" }, totalPages: { type: "integer" },
            } },
            source: { $ref: "#/components/schemas/CatalogueSummary" },
          } } },
        },
        OpportunityDetailResponse: {
          type: "object", required: ["success", "data"],
          properties: { success: { type: "boolean", enum: [true] }, data: { type: "object", required: ["opportunity", "source"], properties: { opportunity: { $ref: "#/components/schemas/Opportunity" }, source: { $ref: "#/components/schemas/CatalogueSummary" } } } },
        },
        OpportunitySourcesResponse: {
          type: "object", required: ["success", "data"],
          properties: { success: { type: "boolean", enum: [true] }, data: { type: "object", required: ["catalogue", "sources"], properties: {
            catalogue: { $ref: "#/components/schemas/CatalogueSummary" },
            sources: { type: "array", items: { type: "object", required: ["id", "name", "status", "records"], properties: {
              id: { type: "string" }, name: { type: "string" }, url: { type: "string", nullable: true },
              attribution: { type: "string", nullable: true }, status: { type: "string", enum: ["catalogued"] }, records: { type: "integer" },
            } } },
          } } },
        },
        OpportunityRequestError: {
          type: "object", required: ["success", "error"],
          properties: { success: { type: "boolean", enum: [false] }, error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, details: { type: "array", items: { type: "string" } } } } },
        },
        NISRErrorResponse: {
          type: "object",
          required: ["success", "error"],
          properties: {
            success: { type: "boolean", enum: [false] },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "NISR_ANALYTICS_UNAVAILABLE" },
                message: { type: "string" },
              },
            },
          },
        },
        NISRMetric: {
          type: "object",
          properties: {
            value: { type: "number", description: "Weighted percentage; not a probability." },
            unit: { type: "string", enum: ["percent"] },
            numeratorWeighted: { type: "number" },
            denominatorWeighted: { type: "number" },
            numeratorUnweighted: { type: "integer" },
            denominatorUnweighted: { type: "integer" },
            denominator: { type: "string" },
            weight: { type: "string", example: "weight2 (NISR annual weight)" },
          },
        },
        NISROverviewResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {
              type: "object",
              required: ["generatedAt", "sources", "methodology", "overview", "census"],
              properties: {
                generatedAt: { type: "string", format: "date-time" },
                sources: { type: "object", additionalProperties: { type: "object" } },
                methodology: { type: "object" },
                overview: { type: "object", additionalProperties: { type: "object" } },
                census: { type: "object" },
              },
            },
          },
        },
        NISRLabourMarketResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {
              type: "object",
              required: ["source", "methodology", "overview", "dimensions", "employmentBySector", "employmentByOccupation"],
              properties: {
                source: { type: "object" },
                methodology: { type: "array", items: { type: "string" } },
                overview: { type: "object", additionalProperties: { type: "object" } },
                dimensions: { type: "object", additionalProperties: { type: "array", items: { type: "object" } } },
                employmentBySector: { type: "object" },
                employmentByOccupation: { type: "object" },
              },
            },
          },
        },
        NISREducationResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {
              type: "object",
              required: ["source", "methodology", "distributions", "limitations"],
              properties: {
                source: { type: "object" },
                methodology: { type: "array", items: { type: "string" } },
                distributions: { type: "object", additionalProperties: { type: "object" } },
                limitations: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        NISREstablishmentsResponse: {
          type: "object",
          required: ["success", "data"],
          properties: {
            success: { type: "boolean", enum: [true] },
            data: {
              type: "object",
              required: ["source", "methodology", "establishmentRecords", "workforceTotals", "dimensions", "limitations"],
              properties: {
                source: { type: "object" },
                methodology: { type: "array", items: { type: "string" } },
                establishmentRecords: { type: "integer" },
                exactDuplicateRowsRetained: { type: "integer" },
                workforceTotals: { type: "object", additionalProperties: { type: "integer" } },
                dimensions: { type: "object", additionalProperties: { type: "array", items: { type: "object" } } },
                limitations: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, "analytics", "nisrRoutes.{ts,js}"),
    path.join(__dirname, "cv", "cvRoutes.{ts,js}"),
    path.join(__dirname, "opportunities", "opportunityRoutes.{ts,js}"),
  ],
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Rwanda Opportunity Intelligence API is running.",
  });
});

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is healthy.",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/analytics/nisr", createNisrAnalyticsRouter());
app.use("/api/v1/cv", createCvRouter());
app.use("/api/v1/opportunities", createOpportunityRouter());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
      const status = "status" in err && typeof err.status === "number" ? err.status : 500;
      if (status === 413) {
        res.status(413).json({
          success: false,
          error: { code: "REQUEST_TOO_LARGE", message: "Request body exceeds the 100kb limit." },
        });
        return;
      }
      if ("type" in err && err.type === "entity.parse.failed") {
        res.status(400).json({
          success: false,
          error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." },
        });
        return;
      }
      console.error("[ERROR] Request failed.");

      res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: "Internal server error.",
    });
  }
);

export default app;
