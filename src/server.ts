import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./createMcpServer.js";
import { handleApiRequest } from "./httpApi.js";

type SessionContext = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

const activeSessions = new Map<string, SessionContext>();

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getRequestPath(req: IncomingMessage): string {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  return url.pathname;
}

async function createHttpSession(): Promise<SessionContext> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    enableJsonResponse: true,
    onsessioninitialized: async (sessionId) => {
      activeSessions.set(sessionId, { server, transport });
    },
    onsessionclosed: async (sessionId) => {
      activeSessions.delete(sessionId);
      await server.close();
    },
  });

  transport.onerror = (error) => {
    console.error("MCP HTTP transport error:", error);
  };

  await server.connect(transport);
  return { server, transport };
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionIdHeader = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

  if (sessionId && !activeSessions.has(sessionId)) {
    sendJson(res, 404, {
      error: "Session not found",
      sessionId,
    });
    return;
  }

  const session = sessionId ? activeSessions.get(sessionId)! : await createHttpSession();

  try {
    await session.transport.handleRequest(req, res);
  } finally {
    if (!session.transport.sessionId) {
      await session.server.close();
    }
  }
}

async function startHttpServer(): Promise<void> {
  const port = Number(process.env.PORT ?? "3000");
  const host = process.env.HOST ?? "0.0.0.0";

  const server = createServer((req, res) => {
    void (async () => {
      const path = getRequestPath(req);

      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, {
          status: "ok",
          service: "vacation-rental-agent",
          transport: "http",
        });
        return;
      }

      if (await handleApiRequest(req, res, path)) {
        return;
      }

      if (path === "/mcp") {
        await handleMcpRequest(req, res);
        return;
      }

      if (req.method === "GET" && path === "/") {
        sendJson(res, 200, {
          status: "ok",
          message: "Vacation Rental ROI Agent MCP server",
          endpoints: ["/mcp", "/health", "/openapi.json", "/api/extract-listing", "/api/analyze-property", "/api/answer-followup"],
        });
        return;
      }

      if (path === "/mcp") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, POST, DELETE");
        res.end("Method Not Allowed");
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    })().catch((error) => {
      console.error("Failed to handle HTTP request:", error);

      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      } else {
        res.end();
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`Vacation Rental ROI Agent MCP server listening on http://${host}:${port}`);
  });
}

async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main(): Promise<void> {
  const mode = process.env.MCP_TRANSPORT ?? (process.env.PORT ? "http" : "stdio");

  if (mode === "http") {
    await startHttpServer();
    return;
  }

  await startStdioServer();
}

main().catch((error) => {
  console.error("Failed to start vacation-rental-agent MCP server:", error);
  process.exit(1);
});
