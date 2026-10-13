#!/usr/bin/env node
// Claude MCP Server for Jarvis — exposes the jarvisapp API as MCP tools over stdio.
// Usage: node mcp-server.js   (server.js must be running)
// Environment: JARVIS_URL (default: http://127.0.0.1:3000)
// Note: stdout is the MCP channel — log only to stderr.

const http = require("http");
const https = require("https");
const readline = require("readline");

const JARVIS_URL = process.env.JARVIS_URL || "http://127.0.0.1:3000";
const DEFAULT_TIMEOUT = 30000;
const AGENT_TIMEOUT = 630000; // server.js allows agent calls up to 620s
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

// --- HTTP helper ---
function request(method, path, body, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, JARVIS_URL);
    const protocol = u.protocol === "https:" ? https : http;
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = protocol.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      timeout,
      headers: payload
        ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
        : {},
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const msg = (parsed && parsed.error) || data;
          reject(new Error(`Jarvis HTTP ${res.statusCode}: ${msg}`));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on("error", e => reject(new Error(`Jarvis unreachable at ${JARVIS_URL} (${e.message}) — is server.js running?`)));
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    if (payload) req.write(payload);
    req.end();
  });
}

const get = (path) => request("GET", path);
const post = (path, body, timeout) => request("POST", path, body, timeout);

// --- Tools ---
const noArgs = { type: "object", properties: {} };

const tools = [
  { name: "get_health", description: "Check that the Jarvis server is up", inputSchema: noArgs,
    handler: () => get("/api/health") },
  { name: "get_status", description: "Get overall OpenClaw status", inputSchema: noArgs,
    handler: () => get("/api/status") },
  { name: "list_agents", description: "List all OpenClaw agents", inputSchema: noArgs,
    handler: () => get("/api/agents") },
  { name: "list_tasks", description: "List all tasks across agents", inputSchema: noArgs,
    handler: () => get("/api/tasks") },
  { name: "list_sessions", description: "List all agent sessions", inputSchema: noArgs,
    handler: () => get("/api/sessions") },
  { name: "list_cron", description: "List scheduled OpenClaw cron jobs", inputSchema: noArgs,
    handler: () => get("/api/cron") },
  { name: "get_models", description: "List available LLM models", inputSchema: noArgs,
    handler: () => get("/api/models") },
  { name: "get_system_status", description: "Get macOS system stats (CPU, RAM, disk, battery, uptime, network)", inputSchema: noArgs,
    handler: () => get("/api/system") },
  { name: "get_market_data", description: "Get simulated market data for paper trading", inputSchema: noArgs,
    handler: () => get("/api/market") },
  {
    name: "get_files",
    description: "Search recent files in ~/Desktop, ~/Downloads, ~/Documents, ~/Pictures and the workspace",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Partial filename match" },
        folder: { type: "string", description: "Desktop, Downloads, Documents, Pictures or workspace" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
    handler: (args) => {
      const params = new URLSearchParams();
      for (const k of ["q", "folder", "limit"]) if (args[k] !== undefined) params.append(k, String(args[k]));
      const qs = params.toString();
      return get(`/api/files${qs ? `?${qs}` : ""}`);
    },
  },
  {
    name: "run_agent",
    description: "Run an OpenClaw agent with a one-shot prompt (can take minutes on a local model)",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt to send" },
        agentId: { type: "string", description: "Agent ID (default agent if omitted)" },
      },
      required: ["prompt"],
    },
    handler: (args) => post("/api/agent/run", { prompt: args.prompt, agentId: args.agentId }, AGENT_TIMEOUT),
  },
  {
    name: "agent_chat",
    description: "Send a message to an OpenClaw agent and get its reply; pass sessionKey to continue a conversation",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID" },
        message: { type: "string", description: "Message to send" },
        sessionKey: { type: "string", description: "Session key to continue (optional)" },
      },
      required: ["agentId", "message"],
    },
    handler: (args) => post("/api/agent/chat",
      { agentId: args.agentId, message: args.message, sessionKey: args.sessionKey }, AGENT_TIMEOUT),
  },
];

const toolsByName = new Map(tools.map(t => [t.name, t]));

// --- JSON-RPC over stdio ---
function send(obj) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...obj }) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      send({
        id,
        result: {
          protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: {} },
          serverInfo: { name: "jarvis", version: "1.0.0" },
          instructions: "Tools for the local Jarvis dashboard: OpenClaw agents, tasks, sessions, cron, system stats, recent files and paper-trading market data.",
        },
      });
      return;
    }
    case "ping":
      send({ id, result: {} });
      return;
    case "tools/list":
      send({ id, result: { tools: tools.map(({ handler, ...t }) => t) } });
      return;
    case "tools/call": {
      const tool = toolsByName.get(params?.name);
      if (!tool) {
        send({ id, error: { code: -32602, message: `Unknown tool: ${params?.name}` } });
        return;
      }
      try {
        const result = await tool.handler(params.arguments || {});
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        send({ id, result: { content: [{ type: "text", text }] } });
      } catch (e) {
        // Tool failures are reported in-band so the model can see and react to them
        send({ id, result: { content: [{ type: "text", text: e.message || String(e) }], isError: true } });
      }
      return;
    }
    default:
      // Notifications (e.g. notifications/initialized) must never get a response
      if (!isNotification) send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

module.exports = { tools };

// Only speak MCP over stdio when run directly (server.js imports the tool list)
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const pending = new Set();

  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const p = handle(msg).catch(e => {
      if (msg.id !== undefined) send({ id: msg.id, error: { code: -32603, message: e.message } });
    }).finally(() => pending.delete(p));
    pending.add(p);
  });

  // Let in-flight tool calls finish before exiting
  rl.on("close", () => Promise.allSettled([...pending]).then(() => process.exit(0)));
  process.stderr.write(`jarvis MCP server ready (JARVIS_URL=${JARVIS_URL})\n`);
}
