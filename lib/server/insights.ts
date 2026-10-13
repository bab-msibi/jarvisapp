// Live data behind the Settings screens: gateway health, model config,
// tunnel status and who is viewing. Everything is reduced to the fields the UI
// shows — the raw CLI output includes partial API keys and must not leave the server.
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { HttpError } from "./http";
import { OPENCLAW, limited, listModels, oc } from "./openclaw";

const execFileAsync = promisify(execFile);

interface RawHealth {
  ok?: boolean; durationMs?: number;
  eventLoop?: { degraded?: boolean; reasons?: string[] };
  plugins?: { loaded?: string[]; errors?: unknown[] };
  channels?: Record<string, {
    enabled?: boolean; configured?: boolean; running?: boolean; connected?: boolean;
    lastError?: string | null; lastConnectedAt?: number; bot?: { username?: string };
  }>;
}

export async function gatewayHealth() {
  const h = await oc<RawHealth>(["health", "--json", "--timeout", "8000"]);
  return {
    ok: !!h.ok,
    latencyMs: h.durationMs ?? null,
    degraded: !!h.eventLoop?.degraded,
    degradedReasons: h.eventLoop?.reasons ?? [],
    plugins: h.plugins?.loaded ?? [],
    pluginErrors: h.plugins?.errors?.length ?? 0,
    channels: Object.entries(h.channels ?? {}).map(([name, c]) => ({
      name,
      enabled: !!c.enabled,
      running: !!c.running,
      connected: !!c.connected,
      lastError: c.lastError ?? null,
      lastConnectedAt: c.lastConnectedAt ?? null,
      botName: c.bot?.username ?? null,
    })),
  };
}

interface RawModelStatus { defaultModel?: string; resolvedDefault?: string; fallbacks?: string[] }

export async function modelConfig() {
  const s = await oc<RawModelStatus>(["models", "status", "--json"]);
  return {
    defaultModel: s.resolvedDefault || s.defaultModel || null,
    fallbacks: s.fallbacks ?? [],
  };
}

export async function setDefaultModel(model: string) {
  // Only allow models OpenClaw already lists — never pass arbitrary input to the CLI
  const { models } = await listModels();
  if (!models.some((m) => m.key === model)) throw new HttpError(400, `Unknown model: ${model}`);
  try {
    await limited(() => execFileAsync(OPENCLAW, ["models", "set", model], { timeout: 30000 }));
  } catch (e) {
    throw new HttpError(500, `openclaw models set failed: ${(e as Error).message}`);
  }
  return modelConfig();
}

// ── Cloudflare tunnel ────────────────────────────────────────────────────────

const CLOUDFLARED_CONFIG = path.join(os.homedir(), ".cloudflared", "config.yml");

export async function tunnelStatus() {
  let hostname: string | null = null;
  try {
    hostname = fs.readFileSync(CLOUDFLARED_CONFIG, "utf8").match(/hostname:\s*(\S+)/)?.[1] ?? null;
  } catch {}
  const running = await execFileAsync("pgrep", ["-f", "cloudflared.*tunnel"]).then(() => true, () => false);

  // Probe the public URL without credentials: Cloudflare Access answers with a
  // redirect to its login page; without Access we'd get Jarvis's own pairing page
  let reachable = false;
  let accessProtected = false;
  if (hostname && running) {
    try {
      const r = await fetch(`https://${hostname}/`, { redirect: "manual", signal: AbortSignal.timeout(6000) });
      reachable = true;
      accessProtected = r.status >= 300 && r.status < 400 && (r.headers.get("location") || "").includes("cloudflareaccess.com");
    } catch {}
  }
  return { configured: !!hostname, hostname, running, reachable, accessProtected, checkedAt: Date.now() };
}

// ── Who is viewing ───────────────────────────────────────────────────────────

const APP_VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version as string; } catch { return "–"; }
})();

const MAC_USER = (() => {
  const username = os.userInfo().username;
  let fullName = username;
  try { fullName = execFileSync("id", ["-F"], { timeout: 2000 }).toString().trim() || username; } catch {}
  return { username, fullName, hostname: os.hostname().split(".")[0] };
})();

export function appInfo() {
  return { appVersion: APP_VERSION, nodeVersion: process.version, mac: MAC_USER };
}
