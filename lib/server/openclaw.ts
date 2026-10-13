import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HttpError } from "./http";

export const execFileAsync = promisify(execFile);
export const OPENCLAW = process.env.OPENCLAW_BIN || "openclaw";
const EXEC_OPTS = { timeout: 30000, maxBuffer: 1024 * 1024 * 4 };

type ExecError = Error & { code?: string | number; killed?: boolean };

// Each CLI call is a full Node process with a multi-second startup. On this CPU-only
// Mac (which also runs Ollama) spawning many at once makes them all slow enough to hit
// the timeout, so short CLI calls queue behind a small concurrency limit.
// Agent chat turns (which can take minutes) bypass it so they can't block the dashboard.
const MAX_CONCURRENT = 3;
const g = globalThis as typeof globalThis & { __ocQueue?: { active: number; waiting: (() => void)[] } };
const queue = (g.__ocQueue ??= { active: 0, waiting: [] });

export async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (queue.active >= MAX_CONCURRENT) await new Promise<void>((r) => queue.waiting.push(r));
  queue.active++;
  try {
    return await fn();
  } finally {
    queue.active--;
    queue.waiting.shift()?.();
  }
}

export async function oc<T = unknown>(args: string[]): Promise<T> {
  let stdout: string;
  try {
    ({ stdout } = await limited(() => execFileAsync(OPENCLAW, args, EXEC_OPTS)));
  } catch (e) {
    const err = e as ExecError;
    if (err.code === "ENOENT") throw new Error(`'${OPENCLAW}' CLI not found in PATH`);
    if (err.killed || err.code === "ETIMEDOUT") throw new Error(`'${OPENCLAW} ${args[0]}' timed out`);
    throw err;
  }
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`'${OPENCLAW} ${args.join(" ")}' returned invalid JSON`);
  }
}

export async function listAgents() {
  const list = await oc<unknown[] | { agents?: unknown[] }>(["agents", "list", "--json"]);
  return { agents: Array.isArray(list) ? list : (list.agents ?? []) };
}

// `openclaw models list` has no --json, so parse its fixed-width table
export async function listModels() {
  const { stdout } = await limited(() => execFileAsync(OPENCLAW, ["models", "list"], EXEC_OPTS));
  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const [header = "", ...rows] = clean.trim().split("\n");
  const pos = ["Model", "Input", "Ctx", "Local", "Auth", "Tags"].map((c) => header.indexOf(c));
  const models = rows
    .filter((r) => r.trim())
    .map((line) => {
      const get = (i: number) => line.slice(pos[i], pos[i + 1] ?? line.length).trim();
      const key = get(0);
      const ctx = get(2);
      const ctxN = parseFloat(ctx) * (ctx.toLowerCase().endsWith("k") ? 1000 : 1);
      return {
        key,
        name: key.replace(/^[^/]+\//, ""),
        input: get(1),
        contextWindow: isNaN(ctxN) ? 0 : Math.round(ctxN),
        local: get(3).toLowerCase() === "yes",
        available: true,
        tags: get(5).split(",").map((t) => t.trim()).filter(Boolean),
      };
    })
    .filter((m) => m.key);
  return { models };
}

export async function agentChat(agentId: string, message: string, sessionKey?: string) {
  const args = ["agent", "--agent", agentId, "--message", message, "--json"];
  if (sessionKey) args.push("--session-key", sessionKey);
  // Model override is controlled by agent config — do not pass --model
  try {
    const { stdout, stderr } = await execFileAsync(OPENCLAW, args, { timeout: 620000, maxBuffer: 1024 * 1024 * 4 });
    // Filter out log lines (start with "[")
    const jsonText = stdout.trim().split("\n").filter((l) => !l.startsWith("[") && l.trim()).join("\n").trim();
    if (!jsonText) {
      const errLines = (stderr || "").split("\n").filter((l) => !l.startsWith("[") && l.trim());
      throw new Error(errLines.join(" ").trim() || "Agent returned no response");
    }
    try {
      return JSON.parse(jsonText);
    } catch {
      return { reply: jsonText, sessionKey };
    }
  } catch (e) {
    const err = e as ExecError;
    if (err.code === "ENOENT") throw new Error(`'${OPENCLAW}' CLI not found in PATH`);
    if (err.killed || err.code === "ETIMEDOUT") throw new Error("Agent timed out. The model may be loading — try again.");
    const msg = (err.message || "").replace(/GatewayClientRequestError: /g, "").replace(/FailoverError: /g, "");
    throw new HttpError(500, msg || "Agent error");
  }
}

export function agentRun(prompt: string, agentId?: string) {
  const args = ["agent", "--output", "json"];
  if (agentId) args.push("--agent", agentId);
  args.push(prompt);
  return oc(args);
}
