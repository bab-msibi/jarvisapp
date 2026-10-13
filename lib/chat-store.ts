"use client";

// Agent chat history and in-flight replies, shared by the whole app and saved to
// localStorage. Replies are background jobs on the server, so one can land after
// you've left the chat or reloaded the page — the watcher (components/chat-replies)
// writes it into the right conversation and announces it.
import { useSyncExternalStore } from "react";

export interface ChatMessage { role: "user" | "agent"; text: string; id: number; model?: string | null; error?: boolean }
export interface ChatSession {
  id: string; agentId: string; createdAt: number; updatedAt?: number;
  messages: ChatMessage[];
  model?: string | null; // per-conversation model override; null/undefined = the agent's own model
}
export interface PendingReply { jobId: string; agentId: string; sessionId: string; startedAt: number; model: string | null }

const MAX_SESSIONS = 50;
const historyKey = (agentId: string) => "jarvis:chat:" + agentId; // same key the app has always used
const PENDING_KEY = "jarvis:chat:pending";

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Store ───────────────────────────────────────────────────────────────────

const histories = new Map<string, ChatSession[]>();
let pending: PendingReply[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function getSessions(agentId: string): ChatSession[] {
  let h = histories.get(agentId);
  if (!h) { h = read<ChatSession[]>(historyKey(agentId), []); histories.set(agentId, h); }
  return h;
}

export function saveSession(session: ChatSession) {
  const list = getSessions(session.agentId);
  const updated = { ...session, updatedAt: Date.now() };
  const idx = list.findIndex((s) => s.id === session.id);
  const next = (idx >= 0 ? list.map((s, i) => (i === idx ? updated : s)) : [...list, updated]).slice(-MAX_SESSIONS);
  histories.set(session.agentId, next);
  write(historyKey(session.agentId), next);
  emit();
}

export function appendMessage(agentId: string, sessionId: string, message: ChatMessage) {
  const s = getSessions(agentId).find((x) => x.id === sessionId);
  if (s) saveSession({ ...s, messages: [...s.messages, message] });
}

export function getPending(): PendingReply[] {
  return (pending ??= read<PendingReply[]>(PENDING_KEY, []));
}

export function addPending(p: PendingReply) {
  pending = [...getPending().filter((x) => x.jobId !== p.jobId), p];
  write(PENDING_KEY, pending);
  emit();
}

export function removePending(jobId: string) {
  pending = getPending().filter((x) => x.jobId !== jobId);
  write(PENDING_KEY, pending);
  emit();
}

export const useChatSessions = (agentId: string) => useSyncExternalStore(subscribe, () => getSessions(agentId), () => []);
export const usePendingReplies = () => useSyncExternalStore(subscribe, getPending, () => []);

export function newChatSession(agentId: string): ChatSession {
  return { id: "jarvisapp-" + Date.now().toString(36), agentId, createdAt: Date.now(), messages: [] };
}

// The conversation with the most recent activity (so a reply that just landed opens first)
export function latestSession(sessions: ChatSession[]) {
  return sessions.reduce<ChatSession | undefined>((best, s) => (!best || (s.updatedAt ?? s.createdAt) > (best.updatedAt ?? best.createdAt) ? s : best), undefined);
}
