// Jarvis app chats as OpenClaw stored them, so every device sees the same conversations.
// App chats use session keys "agent:<agentId>:jarvisapp-<id>"; OpenClaw writes each
// session's transcript to ~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HttpError } from "./http";

const AGENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CHAT_ID = /^jarvisapp-[a-z0-9]{4,20}$/;
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_CHATS = 50;

export interface HistoryMessage { role: "user" | "agent"; text: string; at: number; model?: string | null; error?: boolean }

interface StoreEntry { sessionId?: string; updatedAt?: number | string; model?: string }

const sessionsDir = (agentId: string) => path.join(os.homedir(), ".openclaw", "agents", agentId, "sessions");

function readStore(agentId: string): Record<string, StoreEntry> {
  if (!AGENT_ID.test(agentId)) throw new HttpError(400, "Invalid agent id");
  try { return JSON.parse(fs.readFileSync(path.join(sessionsDir(agentId), "sessions.json"), "utf8")); } catch { return {}; }
}

// "[Wed 2026-10-14 12:09 GMT+2] what is…" → "what is…"
const stripStamp = (t: string) => t.replace(/^\[[^\]]*\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, "");
// Some models wrap the answer in <final> or leave <think> blocks in the text
const cleanReply = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\/?final>/g, "").trim();

type Part = { type?: string; text?: string };

function transcript(agentId: string, sessionId: string): HistoryMessage[] {
  if (!SESSION_ID.test(sessionId)) return [];
  let lines: string[];
  try { lines = fs.readFileSync(path.join(sessionsDir(agentId), `${sessionId}.jsonl`), "utf8").split("\n"); } catch { return []; }
  const out: HistoryMessage[] = [];
  // A turn can hold several assistant messages (tool calls in between); show its last text, like the live reply
  let reply: HistoryMessage | null = null;
  let failure: HistoryMessage | null = null;
  const flush = () => {
    if (reply) out.push(reply); else if (failure) out.push(failure);
    reply = failure = null;
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    let e: { type?: string; customType?: string; timestamp?: string; data?: { error?: string }; message?: { role?: string; content?: string | Part[]; model?: string } };
    try { e = JSON.parse(line); } catch { continue; }
    const at = e.timestamp ? Date.parse(e.timestamp) : 0;
    if (e.type === "custom" && e.customType === "openclaw:prompt-error") {
      const err = e.data?.error || "The agent hit an error";
      failure = { role: "agent", text: err === "This operation was aborted" ? "Stopped before it finished replying." : err, at, error: true };
      continue;
    }
    const m = e.message;
    if (e.type !== "message" || !m) continue;
    const text = typeof m.content === "string" ? m.content
      : (m.content ?? []).filter((p) => p.type === "text" && p.text).map((p) => p.text).join("\n");
    if (m.role === "user") {
      flush();
      out.push({ role: "user", text: stripStamp(text), at });
    } else if (m.role === "assistant") {
      const clean = cleanReply(text);
      // OpenClaw back-fills a failed turn with a placeholder when the next message arrives
      if (/^\[assistant turn failed[^\]]*\]$/i.test(clean)) failure ??= { role: "agent", text: "This reply failed before it produced any text.", at, error: true };
      else if (clean) reply = { role: "agent", text: clean, at, model: m.model ?? null };
    }
  }
  flush();
  return out;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

export function listAppChats(agentId: string) {
  const store = readStore(agentId);
  const prefix = `agent:${agentId}:`;
  const chats = Object.entries(store)
    .filter(([key]) => key.startsWith(prefix) && CHAT_ID.test(key.slice(prefix.length)))
    .map(([key, e]) => ({ id: key.slice(prefix.length), sessionId: e.sessionId ?? "", updatedAt: num(e.updatedAt), model: e.model ?? null }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHATS)
    .map(({ sessionId, ...c }) => {
      const msgs = sessionId ? transcript(agentId, sessionId) : [];
      const last = msgs.at(-1);
      return { ...c, count: msgs.length, preview: last ? last.text.replace(/\s+/g, " ").slice(0, 120) : "" };
    });
  return { chats };
}

export function chatMessages(agentId: string, chatId: string) {
  if (!CHAT_ID.test(chatId)) throw new HttpError(400, "Invalid chat id");
  const entry = readStore(agentId)[`agent:${agentId}:${chatId}`];
  return { messages: entry?.sessionId ? transcript(agentId, entry.sessionId) : [] };
}
