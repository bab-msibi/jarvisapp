import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { HttpError } from "./http";

const MCP_NAME = "jarvis";
const ROOT = process.cwd();
const MCP_SCRIPT = path.join(ROOT, "mcp-server.js");
const CLAUDE_DESKTOP_CONFIG = path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
const CLAUDE_CODE_CONFIG = path.join(os.homedir(), ".claude.json");
const JARVIS_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;

interface McpConfig { mcpServers?: Record<string, unknown>; [k: string]: unknown }

// GUI apps like Claude Desktop don't inherit the shell PATH, so use an absolute node path —
// preferring Homebrew's stable symlink over the versioned Cellar path that breaks on upgrade
function nodePath() {
  for (const p of ["/opt/homebrew/bin/node", "/usr/local/bin/node"]) {
    try { if (fs.realpathSync(/*turbopackIgnore: true*/ p) === fs.realpathSync(/*turbopackIgnore: true*/ process.execPath)) return p; } catch {}
  }
  return process.execPath;
}

const mcpEntry = () => ({ command: nodePath(), args: [MCP_SCRIPT], env: { JARVIS_URL } });

// null = missing, undefined = unreadable/invalid
function readJsonFile(file: string): McpConfig | null | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return (e as { code?: string }).code === "ENOENT" ? null : undefined;
  }
}

// mcp-server.js is a standalone CommonJS CLI; load it at runtime rather than bundling it
function mcpTools(): { name: string; description: string }[] {
  const req = createRequire(path.join(ROOT, "package.json"));
  return req(MCP_SCRIPT).tools;
}

export function mcpStatus() {
  const desktop = readJsonFile(CLAUDE_DESKTOP_CONFIG);
  const code = readJsonFile(CLAUDE_CODE_CONFIG);
  const project = readJsonFile(path.join(ROOT, ".mcp.json"));
  const entry = mcpEntry();
  return {
    name: MCP_NAME,
    script: MCP_SCRIPT,
    tools: mcpTools().map((t) => ({ name: t.name, description: t.description })),
    desktop: {
      installed: !!desktop?.mcpServers?.[MCP_NAME],
      appFound: desktop !== null || fs.existsSync(path.dirname(CLAUDE_DESKTOP_CONFIG)),
      configPath: CLAUDE_DESKTOP_CONFIG,
    },
    code: {
      userInstalled: !!code?.mcpServers?.[MCP_NAME],
      projectInstalled: !!project?.mcpServers?.[MCP_NAME],
      command: `claude mcp add --scope user ${MCP_NAME} -e JARVIS_URL=${JARVIS_URL} -- node "${MCP_SCRIPT}"`,
    },
    config: { mcpServers: { [MCP_NAME]: entry } },
  };
}

export function installDesktopMcp() {
  const current = readJsonFile(CLAUDE_DESKTOP_CONFIG);
  if (current === undefined) throw new HttpError(409, "Claude Desktop config exists but isn't valid JSON — fix it by hand first");
  const config: McpConfig = current || {};
  if (current) fs.copyFileSync(CLAUDE_DESKTOP_CONFIG, `${CLAUDE_DESKTOP_CONFIG}.bak`);
  else fs.mkdirSync(path.dirname(CLAUDE_DESKTOP_CONFIG), { recursive: true });
  config.mcpServers = { ...(config.mcpServers || {}), [MCP_NAME]: mcpEntry() };
  fs.writeFileSync(CLAUDE_DESKTOP_CONFIG, JSON.stringify(config, null, 2) + "\n");
  return mcpStatus();
}
