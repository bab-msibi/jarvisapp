// Readable labels for OpenClaw sessions, shared by the Dashboard and the Agents screens
import type { Session } from "@/lib/types";

const SESSION_KIND: Record<string, string> = { direct: "Direct chat", cron: "Cron job", group: "Discord group", "spawn-child": "Sub-agent" };

// "agent:main:jarvisapp-mv6o9dfm" → "Jarvis app chat"; "agent:main:main" → "Direct chat · main"
export function sessionTitle(s: Session) {
  const kind = SESSION_KIND[s.kind ?? ""] || s.kind || "Session";
  const tail = s.key?.split(":").slice(2).join(":") || "";
  if (tail.startsWith("jarvisapp")) return "Jarvis app chat";
  if (tail.startsWith("task-")) return "Task";
  if (tail === "main") return `${kind} · main`;
  if (tail.startsWith("cron")) return "Cron run";
  return kind;
}

// totalTokens is often null; input + output is the next best count
export const sessionTokens = (s: Session) => s.totalTokens ?? ((s.inputTokens ?? 0) + (s.outputTokens ?? 0));

// Share of the model's context window the last prompt used (over 100% = it's being truncated)
export const contextPct = (s: Session) => (s.contextTokens && s.inputTokens ? Math.round((s.inputTokens / s.contextTokens) * 100) : null);

export const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
