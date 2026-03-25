import { IncomingMessage, ServerResponse } from "node:http";
import { ScenarioEngine } from "./services/scenarioEngine.js";
import { createAnalyzePropertyTool } from "./tools/analyzeProperty.js";
import { createAnswerFollowupTool } from "./tools/answerFollowup.js";
import { extractListing } from "./tools/extractListing.js";

const scenarioEngine = new ScenarioEngine();
const analyzeProperty = createAnalyzePropertyTool(scenarioEngine);
const answerFollowup = createAnswerFollowupTool(scenarioEngine);

type JsonObject = Record<string, unknown>;

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
      {
        url: baseUrl,
      },
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
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                    rawText: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Extracted property details and diagnostics.",
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
                schema: {
                  type: "object",
                },
              },
            },
          },
          responses: {
            "200": {
              description: "ROI analysis result with explanation and analysis_id.",
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
                schema: {
                  type: "object",
                  required: ["analysis_id", "question"],
                  properties: {
                    analysis_id: { type: "string" },
                    question: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated analysis result for the follow-up scenario.",
            },
          },
        },
      },
    },
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
