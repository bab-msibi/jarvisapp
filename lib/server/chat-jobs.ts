// Agent chat turns run as background jobs. A turn can take minutes on a local
// model, longer than Cloudflare keeps a tunneled request open (~100 s), and the
// phone may lock or reload meanwhile — so the browser starts a job and polls it.
//
// Each turn is its own detached process with its state in ~/.jarvis/chat-jobs, so a
// Jarvis restart (rebuild, crash, launchd) neither kills a reply nor forgets it.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentArgs, agentErrorMessage, OPENCLAW, parseAgentOutput, replyText } from "./openclaw";

export interface ChatJob {
  id: string;
  agentId: string;
  sessionKey: string | null;
  model: string | null;
  status: "running" | "done" | "error";
  reply: string | null;
  error: string | null;
  usedModel: string | null;
  startedAt: number;
  finishedAt: number | null;
}

interface StoredJob extends ChatJob { pid: number | null }

const DIR = path.join(os.homedir(), ".jarvis", "chat-jobs");
const KEEP_MS = 60 * 60 * 1000; // finished jobs stay readable for an hour
const TIMEOUT_MS = 620 * 1000;
const JOB_ID = /^[A-Za-z0-9_-]{6,32}$/;

const file = (id: string, ext: string) => path.join(DIR, `${id}.${ext}`);
const readText = (p: string) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };

function save(job: StoredJob) {
  fs.writeFileSync(file(job.id, "json.tmp"), JSON.stringify(job));
  fs.renameSync(file(job.id, "json.tmp"), file(job.id, "json"));
}

const alive = (pid: number | null) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
};

const publicJob = ({ pid: _pid, ...job }: StoredJob): ChatJob => job;

function finish(job: StoredJob, patch: Partial<StoredJob>) {
  Object.assign(job, patch, { finishedAt: Date.now(), pid: null });
  save(job);
  for (const ext of ["out", "err", "exit"]) fs.rmSync(file(job.id, ext), { force: true });
  return job;
}

// Bring a running job's state up to date from its output files
function refresh(job: StoredJob): StoredJob {
  if (job.status !== "running") return job;
  const exit = readText(file(job.id, "exit"));
  if (exit !== null) {
    const code = parseInt(exit.trim(), 10);
    const stdout = readText(file(job.id, "out")) ?? "";
    const stderr = readText(file(job.id, "err")) ?? "";
    if (code !== 0) return finish(job, { status: "error", error: agentErrorMessage(stderr, `Agent exited with code ${code}`) });
    try {
      const raw = parseAgentOutput(stdout, job.sessionKey ?? undefined);
      const usedModel = (raw as { result?: { meta?: { agentMeta?: { model?: string } } } })?.result?.meta?.agentMeta?.model ?? job.model;
      return finish(job, { status: "done", reply: replyText(raw), usedModel });
    } catch (e) {
      return finish(job, { status: "error", error: (e as Error).message });
    }
  }
  if (Date.now() - job.startedAt > TIMEOUT_MS) {
    stopProcess(job.pid);
    return finish(job, { status: "error", error: "Agent timed out after 10 minutes. The model may be overloaded — try again." });
  }
  if (!alive(job.pid)) return finish(job, { status: "error", error: "The reply process ended without a result" });
  return job;
}

function load(id: string): StoredJob | null {
  const text = readText(file(id, "json"));
  if (!text) return null;
  try { return JSON.parse(text) as StoredJob; } catch { return null; }
}

function stopProcess(pid: number | null) {
  // The wrapper shell leads its own process group; signal the whole group so the CLI goes too
  if (pid) { try { process.kill(-pid, "SIGTERM"); } catch {} }
}

function prune() {
  const cutoff = Date.now() - KEEP_MS;
  let names: string[] = [];
  try { names = fs.readdirSync(DIR); } catch { return; }
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const job = load(n.slice(0, -5));
    if (job?.finishedAt && job.finishedAt < cutoff) fs.rmSync(path.join(DIR, n), { force: true });
  }
}

export function startChatJob(agentId: string, message: string, sessionKey?: string, model?: string): ChatJob {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  prune();
  const id = crypto.randomBytes(9).toString("base64url");
  // sh records the CLI's exit code after it finishes; "$@" keeps the message out of the shell's parsing
  const child = spawn("/bin/sh", ["-c", '"$@" >"$JOB_OUT" 2>"$JOB_ERR"; echo $? >"$JOB_EXIT"', "sh", OPENCLAW, ...agentArgs(agentId, message, sessionKey, model)], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, JOB_OUT: file(id, "out"), JOB_ERR: file(id, "err"), JOB_EXIT: file(id, "exit") },
  });
  child.unref();
  const job: StoredJob = {
    id, agentId, sessionKey: sessionKey ?? null, model: model ?? null,
    status: "running", reply: null, error: null, usedModel: null,
    startedAt: Date.now(), finishedAt: null, pid: child.pid ?? null,
  };
  save(job);
  return publicJob(job);
}

export function getChatJob(id: string): ChatJob | null {
  if (!JOB_ID.test(id)) return null;
  const job = load(id);
  return job ? publicJob(refresh(job)) : null;
}

export function stopChatJob(id: string): ChatJob | null {
  if (!JOB_ID.test(id)) return null;
  const job = load(id);
  if (!job) return null;
  if (job.status !== "running") return publicJob(job);
  stopProcess(job.pid);
  return publicJob(finish(job, { status: "error", error: "Stopped" }));
}

// Agents with a chat turn being generated right now
export function busyAgents() {
  let names: string[] = [];
  try { names = fs.readdirSync(DIR); } catch { return []; }
  const busy = new Set<string>();
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const job = load(n.slice(0, -5));
    if (job?.status === "running" && refresh(job).status === "running") busy.add(job.agentId);
  }
  return [...busy];
}
