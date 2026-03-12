import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sampleAnalyzeInput = {
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

const sampleExtractInput = {
  url: "https://example.com/property",
  rawText:
    "Address: 456 Ocean Dr, Destin, FL. Price: $615,000. Beautiful condo with 3 beds, 2 baths, 1450 sqft. HOA $975/month. Taxes $5,800/year. Great turnkey vacation rental opportunity.",
};

function parseArgs(argv) {
  const args = {
    serverCommand: "node",
    serverArgs: ["dist/server.js"],
    tool: "analyze_property",
    payload: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--server-command") {
      args.serverCommand = argv[i + 1];
      i += 1;
    } else if (arg === "--server-args") {
      args.serverArgs = argv[i + 1]?.split(",").filter(Boolean) ?? [];
      i += 1;
    } else if (arg === "--tool") {
      args.tool = argv[i + 1];
      i += 1;
    } else if (arg === "--payload") {
      args.payload = JSON.parse(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function defaultPayloadForTool(tool) {
  if (tool === "extract_listing") {
    return sampleExtractInput;
  }

  if (tool === "answer_followup") {
    return {
      analysis_id: "PASTE_ANALYSIS_ID_HERE",
      question: "What if occupancy drops to 50%?",
    };
  }

  return sampleAnalyzeInput;
}

function parseToolResult(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text;

  if (!text) {
    return result;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ...result,
      parsedText: text,
    };
  }
}

async function main() {
  const { serverCommand, serverArgs, tool, payload } = parseArgs(process.argv.slice(2));

  const client = new Client({
    name: "vacation-rental-agent-local-client",
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: serverCommand,
    args: serverArgs,
  });

  await client.connect(transport);

  const result = await client.callTool({
    name: tool,
    arguments: payload ?? defaultPayloadForTool(tool),
  });

  console.log(JSON.stringify(parseToolResult(result), null, 2));

  if (tool === "answer_followup") {
    console.error(
      "Note: answer_followup requires the same live MCP server session as the original analyze_property call unless the server persists analyses.",
    );
  }

  await client.close();
}

main().catch((error) => {
  console.error("MCP client failed:", error);
  process.exit(1);
});
