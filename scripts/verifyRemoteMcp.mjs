import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const sampleExtractInput = {
  rawText:
    "Turnkey beach condo at 456 Ocean Dr, Destin, FL 32541 listed for $615,000. 3 beds, 2 baths, 1,450 sqft. HOA $975/month. Property taxes $5,800/year. Renovated condo with strong short-term rental history.",
};

function usage() {
  console.log(`Usage:
  node scripts/verifyRemoteMcp.mjs --url https://your-domain.up.railway.app

Options:
  --url <base-url>       Base public URL for the deployed server (required)
  --skip-tool-call       Only check /health and MCP initialize + listTools
  --help                 Show this help message
`);
}

function parseArgs(argv) {
  const args = {
    url: null,
    skipToolCall: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--url") {
      args.url = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--skip-tool-call") {
      args.skipToolCall = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
  }

  if (!args.url) {
    usage();
    throw new Error("Missing required --url argument.");
  }

  return args;
}

async function checkHealth(baseUrl) {
  const healthUrl = new URL("/health", baseUrl);
  const response = await fetch(healthUrl);
  const bodyText = await response.text();

  return {
    url: healthUrl.toString(),
    status: response.status,
    ok: response.ok,
    body: bodyText,
  };
}

async function verifyMcp(baseUrl, skipToolCall) {
  const mcpUrl = new URL("/mcp", baseUrl);
  const client = new Client({
    name: "vacation-rental-agent-remote-verifier",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(mcpUrl);

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const toolNames = (toolsResult.tools ?? []).map((tool) => tool.name);

    let sampleCallResult = null;

    if (!skipToolCall) {
      const result = await client.callTool({
        name: "extract_listing",
        arguments: sampleExtractInput,
      });

      sampleCallResult = result?.content?.find((item) => item.type === "text")?.text ?? null;
    }

    return {
      url: mcpUrl.toString(),
      connected: true,
      sessionId: transport.sessionId ?? null,
      tools: toolNames,
      sampleCallResult,
    };
  } finally {
    try {
      await transport.terminateSession();
    } catch {
      // Best effort cleanup only.
    }

    await client.close();
  }
}

async function main() {
  const { url, skipToolCall } = parseArgs(process.argv.slice(2));
  const baseUrl = new URL(url);

  const health = await checkHealth(baseUrl);

  if (!health.ok) {
    console.error(JSON.stringify({ health }, null, 2));
    process.exit(1);
  }

  const mcp = await verifyMcp(baseUrl, skipToolCall);

  console.log(
    JSON.stringify(
      {
        health,
        mcp,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Remote MCP verification failed:", error);
  process.exit(1);
});
