// Cron job history and controls, via the openclaw CLI
import { invalidate, peek } from "./cache";
import { HttpError } from "./http";
import type { modelConfig } from "./insights";
import { execFileAsync, limited, oc, OPENCLAW } from "./openclaw";

const JOB_ID = /^[A-Za-z0-9-]{6,64}$/;

function checkId(id: unknown): string {
  if (typeof id !== "string" || !JOB_ID.test(id)) throw new HttpError(400, "Invalid job id");
  return id;
}

export interface CronRun {
  ts: number; jobId: string; action?: string; status?: string; error?: string; summary?: string;
  runAtMs?: number; durationMs?: number; model?: string; provider?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  delivered?: boolean; deliveryStatus?: string;
  delivery?: { resolved?: { channel?: string; to?: string; ok?: boolean } };
}

export async function cronRuns(id: unknown, limit = 15) {
  const res = await oc<{ entries?: CronRun[] }>(["cron", "runs", "--id", checkId(id), "--limit", String(limit)]);
  // Newest first; only finished runs carry a result
  const entries = (res.entries ?? []).filter((e) => e.action !== "started").sort((a, b) => (b.runAtMs ?? b.ts) - (a.runAtMs ?? a.ts));
  return { entries };
}

// Commands that print text rather than JSON; report OpenClaw's own error line on failure
async function ocText(args: string[]) {
  try {
    const { stdout } = await limited(() => execFileAsync(OPENCLAW, args, { timeout: 45000, maxBuffer: 1024 * 1024 }));
    return stdout.trim();
  } catch (e) {
    const err = e as Error & { stderr?: string; killed?: boolean };
    if (err.killed) throw new HttpError(504, `openclaw ${args[0]} ${args[1]} timed out`);
    const line = (err.stderr || "").split("\n").filter((l) => l.trim() && !l.startsWith("[")).pop();
    throw new HttpError(500, (line || err.message).replace(/^(?:\w*Error:\s*)+/, "").slice(0, 300));
  }
}

type ModelConfig = Awaited<ReturnType<typeof modelConfig>>;

export async function cronAction(body: { id?: unknown; action?: unknown; model?: unknown }) {
  const id = checkId(body.id);
  let args: string[];
  switch (body.action) {
    case "run": args = ["cron", "run", id]; break;
    case "enable": args = ["cron", "enable", id]; break;
    case "disable": args = ["cron", "disable", id]; break;
    case "model": {
      const model = body.model;
      if (typeof model !== "string" || !/^[A-Za-z0-9][\w.:/-]*$/.test(model)) throw new HttpError(400, "Invalid model id");
      const cfg = peek<ModelConfig>("modelConfig");
      if (cfg && !cfg.chatModels.includes(model)) throw new HttpError(400, `Model not allowed: ${model}`);
      args = ["cron", "edit", id, "--model", model];
      break;
    }
    default: throw new HttpError(400, "action must be run, enable, disable or model");
  }
  const output = await ocText(args);
  invalidate("cron", "agents");
  return { ok: true, output };
}
