import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const analyzeInput = {
  property: {
    address: "123 Beach Ave, Gulf Shores, AL",
    price: 420000,
    beds: 2,
    baths: 2,
    sqft: 1100,
    hoa_monthly: 850,
    tax_annual: 4200,
    property_type: "condo",
    raw_listing_text:
      "2 bed / 2 bath beachfront condo with strong short-term rental potential.",
  },
  assumptions: {
    nightly_rate: 225,
    occupancy_rate: 0.58,
    management_rate: 0.2,
    maintenance_rate: 0.08,
    platform_fee_rate: 0.03,
    insurance_annual: 1800,
    utilities_annual: 3600,
    loan_rate: 0.0675,
    down_payment_percent: 0.2,
    loan_term_years: 30,
    closing_cost_percent: 0.03,
  },
};

function parseTextResult(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("No text content returned from MCP tool.");
  }

  return JSON.parse(text);
}

async function main() {
  const question = process.argv[2] ?? "What if occupancy drops to 50%?";

  const client = new Client({
    name: "vacation-rental-agent-workflow-client",
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/server.js"],
  });

  await client.connect(transport);

  const analyzeResult = await client.callTool({
    name: "analyze_property",
    arguments: analyzeInput,
  });

  const analysis = parseTextResult(analyzeResult);

  const followupResult = await client.callTool({
    name: "answer_followup",
    arguments: {
      analysis_id: analysis.analysis_id,
      question,
    },
  });

  const followup = parseTextResult(followupResult);

  console.log(JSON.stringify({ analysis, followup }, null, 2));

  await client.close();
}

main().catch((error) => {
  console.error("Workflow client failed:", error);
  process.exit(1);
});
