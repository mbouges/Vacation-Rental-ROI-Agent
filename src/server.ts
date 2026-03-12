import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAnalyzePropertyTool } from "./tools/analyzeProperty.js";
import { createAnswerFollowupTool } from "./tools/answerFollowup.js";
import { extractListing } from "./tools/extractListing.js";
import { ScenarioEngine } from "./services/scenarioEngine.js";

const scenarioEngine = new ScenarioEngine();
const analyzeProperty = createAnalyzePropertyTool(scenarioEngine);
const answerFollowup = createAnswerFollowupTool(scenarioEngine);

const server = new McpServer({
  name: "vacation-rental-agent",
  version: "0.1.0",
});

server.tool(
  "extract_listing",
  "Extract property details from a listing URL or optional raw listing text.",
  {
    url: z.string().url().optional(),
    rawText: z.string().optional(),
  },
  async ({ url, rawText }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await extractListing({ url, rawText }), null, 2),
      },
    ],
  }),
);

server.tool(
  "analyze_property",
  "Run vacation-rental ROI calculations from property details and investment assumptions.",
  {
    property: z.object({
      address: z.string(),
      price: z.number().positive(),
      beds: z.number().nullable().optional(),
      baths: z.number().nullable().optional(),
      sqft: z.number().nullable().optional(),
      hoa_monthly: z.number().nullable().optional(),
      tax_annual: z.number().nullable().optional(),
      property_type: z.enum(["condo", "house", "townhouse"]).nullable().optional(),
      raw_listing_text: z.string().optional(),
      listing_url: z.string().url().optional(),
    }),
    assumptions: z.object({
      nightly_rate: z.number().nonnegative(),
      occupancy_rate: z.number().nonnegative(),
      management_rate: z.number().nonnegative(),
      maintenance_rate: z.number().nonnegative(),
      platform_fee_rate: z.number().nonnegative().optional(),
      insurance_annual: z.number().nonnegative(),
      utilities_annual: z.number().nonnegative(),
      loan_rate: z.number().nonnegative(),
      down_payment_percent: z.number().nonnegative(),
      loan_term_years: z.number().positive().optional(),
      closing_cost_percent: z.number().nonnegative().optional(),
    }),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await analyzeProperty(input), null, 2),
      },
    ],
  }),
);

server.tool(
  "answer_followup",
  "Update an existing ROI analysis based on a natural-language follow-up scenario.",
  {
    analysis_id: z.string().min(1),
    question: z.string().min(1),
  },
  async ({ analysis_id, question }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await answerFollowup({ analysis_id, question }), null, 2),
      },
    ],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start vacation-rental-agent MCP server:", error);
  process.exit(1);
});
