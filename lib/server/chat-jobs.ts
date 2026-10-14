// Agent chat turns run as background jobs. A turn can take minutes on a local
// model, longer than Cloudflare keeps a tunneled request open (~100 s), and the
// phone may lock or reload meanwhile — so the browser starts a job and polls it.
import crypto from "node:crypto";
import { agentChat, replyText } from "./openclaw";

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

const KEEP_MS = 60 * 60 * 1000; // finished jobs stay readable for an hour
const g = globalThis as typeof globalThis & { __chatJobs?: Map<string, ChatJob> };
const jobs = (g.__chatJobs ??= new Map());

function prune() {
  const cutoff = Date.now() - KEEP_MS;
  for (const [id, j] of jobs) if (j.finishedAt && j.finishedAt < cutoff) jobs.delete(id);
}

export function startChatJob(agentId: string, message: string, sessionKey?: string, model?: string): ChatJob {
  prune();
  const job: ChatJob = {
    id: crypto.randomBytes(9).toString("base64url"),
    agentId, sessionKey: sessionKey ?? null, model: model ?? null,
    status: "running", reply: null, error: null, usedModel: null,
    startedAt: Date.now(), finishedAt: null,
  };
  jobs.set(job.id, job);
  agentChat(agentId, message, sessionKey, model)
    .then((raw) => {
      job.reply = replyText(raw);
      job.usedModel = (raw as { result?: { meta?: { agentMeta?: { model?: string } } } })?.result?.meta?.agentMeta?.model ?? model ?? null;
      job.status = "done";
    })
    .catch((e: Error) => {
      job.error = e.message || "Agent error";
      job.status = "error";
    })
    .finally(() => { job.finishedAt = Date.now(); });
  return job;
}

export const getChatJob = (id: string) => jobs.get(id) ?? null;

// Agents with a chat turn being generated right now
export const busyAgents = () => [...new Set([...jobs.values()].filter((j) => j.status === "running").map((j) => j.agentId))];
