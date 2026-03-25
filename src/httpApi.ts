import { IncomingMessage, ServerResponse } from "node:http";
import { ScenarioEngine } from "./services/scenarioEngine.js";
import { createAnalyzePropertyTool } from "./tools/analyzeProperty.js";
import { createAnswerFollowupTool } from "./tools/answerFollowup.js";
import { extractListing } from "./tools/extractListing.js";

const scenarioEngine = new ScenarioEngine();
const analyzeProperty = createAnalyzePropertyTool(scenarioEngine);
const answerFollowup = createAnswerFollowupTool(scenarioEngine);

type JsonObject = Record<string, unknown>;

const productionBaseUrl = "https://vacation-rental-roi-agent-production.up.railway.app";

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as JsonObject;
}

function getBaseUrl(req: IncomingMessage): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers.host ?? "localhost";
  return `${protocol ?? "http"}://${host}`;
}

function buildOpenApiComponents() {
  return {
    schemas: {
      PropertyType: {
        type: "string",
        enum: ["condo", "house", "townhouse"],
      },
      ExtractionConfidence: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      FetchStatus: {
        type: "string",
        enum: ["not_applicable", "success", "blocked", "error"],
      },
      ParseStatus: {
        type: "string",
        enum: ["success", "partial", "failed", "corrupt"],
      },
      ExtractionFieldStatus: {
        type: "string",
        enum: ["extracted", "missing", "invalid"],
      },
      ExtractionFieldSource: {
        type: "string",
        enum: ["site_selector", "structured_data", "heuristic_text", "missing"],
      },
      ExtractionFieldProvenance: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { $ref: "#/components/schemas/ExtractionFieldSource" },
          confidence: {
            oneOf: [
              { $ref: "#/components/schemas/ExtractionConfidence" },
              { type: "string", enum: ["none"] },
            ],
          },
          status: { $ref: "#/components/schemas/ExtractionFieldStatus" },
        },
        required: ["source", "confidence", "status"],
      },
      AssumptionPromptField: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          reason: { type: "string" },
          suggested_value: {
            oneOf: [{ type: "number" }, { type: "null" }],
          },
          question: { type: "string" },
        },
        required: ["field", "reason", "suggested_value", "question"],
      },
      AssumptionPromptGuidance: {
        type: "object",
        additionalProperties: false,
        properties: {
          property_fields: {
            type: "object",
            additionalProperties: false,
            properties: {
              known: { type: "array", items: { type: "string" } },
              missing: { type: "array", items: { type: "string" } },
            },
            required: ["known", "missing"],
          },
          assumption_fields: {
            type: "object",
            additionalProperties: false,
            properties: {
              required: { type: "array", items: { type: "string" } },
              missing: { type: "array", items: { type: "string" } },
              suggested_defaults: {
                type: "object",
                additionalProperties: { type: "number" },
              },
            },
            required: ["required", "missing", "suggested_defaults"],
          },
          llm_prompt: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              follow_up_questions: { type: "array", items: { type: "string" } },
              fields_to_confirm: {
                type: "array",
                items: { $ref: "#/components/schemas/AssumptionPromptField" },
              },
            },
            required: ["summary", "follow_up_questions", "fields_to_confirm"],
          },
        },
        required: ["property_fields", "assumption_fields", "llm_prompt"],
      },
      ManualEntryPrompt: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" },
          next_step: { type: "string" },
          preferred_input: { type: "string", enum: ["paste_listing_text"] },
          required_property_facts: { type: "array", items: { type: "string" } },
          helpful_property_facts: { type: "array", items: { type: "string" } },
          optional_assumptions: { type: "array", items: { type: "string" } },
          requested_property_fields: { type: "array", items: { type: "string" } },
          suggested_user_prompt: { type: "string" },
          follow_up_questions: { type: "array", items: { type: "string" } },
        },
        required: [
          "reason",
          "next_step",
          "preferred_input",
          "required_property_facts",
          "helpful_property_facts",
          "optional_assumptions",
          "requested_property_fields",
          "suggested_user_prompt",
          "follow_up_questions",
        ],
      },
      ExtractListingRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", format: "uri" },
          rawText: { type: "string" },
        },
      },
      ExtractListingResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          address: { oneOf: [{ type: "string" }, { type: "null" }] },
          price: { oneOf: [{ type: "number" }, { type: "null" }] },
          beds: { oneOf: [{ type: "number" }, { type: "null" }] },
          baths: { oneOf: [{ type: "number" }, { type: "null" }] },
          sqft: { oneOf: [{ type: "number" }, { type: "null" }] },
          hoa_monthly: { oneOf: [{ type: "number" }, { type: "null" }] },
          tax_annual: { oneOf: [{ type: "number" }, { type: "null" }] },
          property_type: {
            oneOf: [{ $ref: "#/components/schemas/PropertyType" }, { type: "null" }],
          },
          raw_listing_text: { type: "string" },
          extracted_fields: { type: "array", items: { type: "string" } },
          missing_fields: { type: "array", items: { type: "string" } },
          extraction_confidence: { $ref: "#/components/schemas/ExtractionConfidence" },
          fetch_status: { $ref: "#/components/schemas/FetchStatus" },
          parse_status: { $ref: "#/components/schemas/ParseStatus" },
          site_domain: { oneOf: [{ type: "string" }, { type: "null" }] },
          invalid_fields: { type: "array", items: { type: "string" } },
          field_provenance: {
            type: "object",
            additionalProperties: { $ref: "#/components/schemas/ExtractionFieldProvenance" },
          },
          assumption_guidance: { $ref: "#/components/schemas/AssumptionPromptGuidance" },
          manual_entry_prompt: {
            oneOf: [{ $ref: "#/components/schemas/ManualEntryPrompt" }, { type: "null" }],
          },
        },
        required: [
          "address",
          "price",
          "beds",
          "baths",
          "sqft",
          "hoa_monthly",
          "tax_annual",
          "property_type",
          "raw_listing_text",
          "extracted_fields",
          "missing_fields",
          "extraction_confidence",
          "fetch_status",
          "parse_status",
          "site_domain",
          "invalid_fields",
          "field_provenance",
          "assumption_guidance",
          "manual_entry_prompt",
        ],
      },
      AnalyzePropertyProperty: {
        type: "object",
        additionalProperties: false,
        properties: {
          address: { type: "string" },
          price: { type: "number" },
          beds: { oneOf: [{ type: "number" }, { type: "null" }] },
          baths: { oneOf: [{ type: "number" }, { type: "null" }] },
          sqft: { oneOf: [{ type: "number" }, { type: "null" }] },
          hoa_monthly: { oneOf: [{ type: "number" }, { type: "null" }] },
          tax_annual: { oneOf: [{ type: "number" }, { type: "null" }] },
          property_type: {
            oneOf: [{ $ref: "#/components/schemas/PropertyType" }, { type: "null" }],
          },
          raw_listing_text: { type: "string" },
          listing_url: { type: "string", format: "uri" },
        },
        required: ["address", "price"],
      },
      AnalyzePropertyAssumptions: {
        type: "object",
        additionalProperties: false,
        properties: {
          nightly_rate: { type: "number" },
          occupancy_rate: { type: "number" },
          management_rate: { type: "number" },
          maintenance_rate: { type: "number" },
          platform_fee_rate: { type: "number" },
          insurance_annual: { type: "number" },
          utilities_annual: { type: "number" },
          loan_rate: { type: "number" },
          down_payment_percent: { type: "number" },
          loan_term_years: { type: "number" },
          closing_cost_percent: { type: "number" },
        },
        required: [
          "nightly_rate",
          "occupancy_rate",
          "management_rate",
          "maintenance_rate",
          "insurance_annual",
          "utilities_annual",
          "loan_rate",
          "down_payment_percent",
        ],
      },
      AnalyzePropertyRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          property: { $ref: "#/components/schemas/AnalyzePropertyProperty" },
          assumptions: { $ref: "#/components/schemas/AnalyzePropertyAssumptions" },
        },
        required: ["property", "assumptions"],
      },
      AnalyzePropertyResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          analysis_id: { type: "string" },
          explanation: { type: "string" },
          gross_revenue: { type: "number" },
          annual_operating_expenses: { type: "number" },
          annual_expenses: { type: "number" },
          noi: { type: "number" },
          annual_cash_flow: { type: "number" },
          cap_rate: { type: "number" },
          cash_on_cash_return: { type: "number" },
          break_even_occupancy: { type: "number" },
          annual_mortgage_payment: { type: "number" },
          total_cash_invested: { type: "number" },
          operating_expense_breakdown: {
            type: "object",
            additionalProperties: { type: "number" },
          },
          total_expense_breakdown: {
            type: "object",
            additionalProperties: { type: "number" },
          },
          assumptions_used: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
        required: [
          "analysis_id",
          "explanation",
          "gross_revenue",
          "annual_operating_expenses",
          "annual_expenses",
          "noi",
          "annual_cash_flow",
          "cap_rate",
          "cash_on_cash_return",
          "break_even_occupancy",
          "annual_mortgage_payment",
          "total_cash_invested",
          "operating_expense_breakdown",
          "total_expense_breakdown",
          "assumptions_used",
        ],
      },
      AnswerFollowupRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          analysis_id: { type: "string" },
          question: { type: "string" },
        },
        required: ["analysis_id", "question"],
      },
      AnswerFollowupResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          analysis_id: { type: "string" },
          question: { type: "string" },
          updated_assumptions: {
            type: "object",
            additionalProperties: { type: "number" },
          },
          analysis: {
            type: "object",
            additionalProperties: true,
          },
          explanation: { type: "string" },
        },
        required: ["analysis_id", "question", "updated_assumptions", "analysis", "explanation"],
      },
      ErrorResponse: {
        type: "object",
        additionalProperties: false,
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
    },
  };
}

export function buildOpenApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Vacation Rental ROI Agent API",
      version: "0.1.0",
      description:
        "REST wrapper around the Vacation Rental ROI Agent business logic for extraction, ROI analysis, and follow-up scenarios.",
    },
    servers: [
      { url: productionBaseUrl, description: "Production" },
      ...(baseUrl !== productionBaseUrl ? [{ url: baseUrl, description: "Current request origin" }] : []),
    ],
    paths: {
      "/api/extract-listing": {
        post: {
          operationId: "extractListing",
          summary: "Extract property details from listing text or a listing URL.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExtractListingRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Extracted property details and diagnostics.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ExtractListingResponse" },
                },
              },
            },
            "400": {
              description: "Invalid request payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/analyze-property": {
        post: {
          operationId: "analyzeProperty",
          summary: "Calculate ROI metrics for a property using explicit assumptions.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnalyzePropertyRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "ROI analysis result with explanation and analysis_id.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AnalyzePropertyResponse" },
                },
              },
            },
            "400": {
              description: "Invalid request payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/answer-followup": {
        post: {
          operationId: "answerFollowup",
          summary: "Run a what-if follow-up against a saved analysis.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnswerFollowupRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated analysis result for the follow-up scenario.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AnswerFollowupResponse" },
                },
              },
            },
            "400": {
              description: "Invalid request payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: buildOpenApiComponents(),
  };
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (req.method === "GET" && path === "/openapi.json") {
    sendJson(res, 200, buildOpenApiDocument(getBaseUrl(req)));
    return true;
  }

  if (req.method !== "POST") {
    return false;
  }

  try {
    const body = await readJsonBody(req);

    if (path === "/api/extract-listing") {
      sendJson(res, 200, await extractListing(body));
      return true;
    }

    if (path === "/api/analyze-property") {
      sendJson(res, 200, await analyzeProperty(body as unknown as Parameters<typeof analyzeProperty>[0]));
      return true;
    }

    if (path === "/api/answer-followup") {
      sendJson(res, 200, await answerFollowup(body as unknown as Parameters<typeof answerFollowup>[0]));
      return true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 400, { error: message });
    return true;
  }

  return false;
}
