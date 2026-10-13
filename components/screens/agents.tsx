"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Dot, Header, Icon, Pill, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useAgentChat, useData, type ChatReply } from "@/lib/queries";
import type { Agent, CronJob, Session } from "@/lib/types";

interface ChatMessage { role: "user" | "agent"; text: string; id: number }
interface ChatSession { id: string; agentId: string; createdAt: number; messages: ChatMessage[] }

// openclaw's JSON reply shape varies by version — take the first text field present
function replyText(data: ChatReply): string {
  const d = data as Record<string, unknown> & { output?: { text?: string; content?: string } };
  const text = d.reply || d.response || d.content || d.text || d.output?.text || d.output?.content;
  return typeof text === "string" ? text : JSON.stringify(data);
}

export function AgentEmoji({ emoji, name, color, size }: { emoji: string | null; name: string; color: string; size: number }) {
  const bg = ({ blue: "#1e3a5f", purple: "#2d1f4e", cyan: "#0e3340", green: "#1a3320", amber: "#3d2800", pink: "#3d1a2e", slate: "#1e2230" } as Record<string, string>)[color] || "#1e2230";
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.46 }}>
      {emoji || name?.charAt(0) || "?"}
    </div>
  );
}

function AgentCard({ a, onClick }: { a: Agent; onClick: () => void }) {
  const statusColor = ({ running: "var(--ok)", idle: "var(--text-ghost)", paused: "var(--warn)", error: "var(--err)" } as Record<string, string>)[a.status] || "var(--text-ghost)";
  const cronBadge = a.cronCount > 0 ? `${a.cronCount} cron` : null;
  const sessBadge = `${a.sessionCount} sessions`;
  return (
    <button className="tap card" onClick={onClick} style={{ padding: 16, width: "100%", textAlign: "left", display: "block" }}>
      {/* Header row */}
      <div className="between" style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <AgentEmoji emoji={a.emoji} name={a.name} color={a.color} size={44} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15.5, fontWeight: 680, letterSpacing: -0.3 }}>{a.name}</span>
              {a.isDefault && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: "var(--accent)", background: "rgba(91,140,255,0.12)", padding: "2px 6px", borderRadius: 6 }}>DEFAULT</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              <span className="mono">{a.model}</span>
              <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
              <span style={{ textTransform: "capitalize" }}>{a.modelProvider}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <Dot size={6} color={statusColor} pulse={a.status === "running"} />
          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, textTransform: "capitalize" }}>{a.status}</span>
        </div>
      </div>

      {/* Current task */}
      <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.4, marginBottom: 13, padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10 }} className="clip">
        {a.task}
      </div>

      {/* Footer stats */}
      <div className="between">
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-faint)" }}>
            <Icon name="message" size={12} stroke={2} />
            <span style={{ fontSize: 11.5 }}>{sessBadge}</span>
          </div>
          {cronBadge && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-faint)" }}>
              <Icon name="clock" size={12} stroke={2} />
              <span style={{ fontSize: 11.5 }}>{cronBadge}</span>
            </div>
          )}
          {a.bindings > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-faint)" }}>
              <Icon name="bolt" size={12} stroke={2} />
              <span style={{ fontSize: 11.5 }}>{a.bindings} bindings</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-ghost)", fontWeight: 540 }}>{a.last}</span>
      </div>
    </button>
  );
}

function CronJobRow({ job }: { job: CronJob }) {
  const lastRun = job.state?.lastRunAtMs;
  const nextRun = job.state?.nextRunAtMs;
  const status = job.state?.lastRunStatus || "–";
  const tone: Tone = status === "error" ? "err" : status === "ok" ? "ok" : "neutral";
  const consecutive = job.state?.consecutiveErrors || 0;
  return (
    <div style={{ padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="between" style={{ marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{job.name}</span>
        <Pill tone={tone} style={{ fontSize: 10 }}>{status}{consecutive > 1 ? ` ×${consecutive}` : ""}</Pill>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-faint)", display: "flex", gap: 12 }}>
        <span>Schedule: <span className="mono">{job.schedule?.expr}</span> {job.schedule?.tz}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 3, display: "flex", gap: 14 }}>
        <span>Last: {relTime(lastRun)}</span>
        {nextRun && <span>Next: {new Date(nextRun).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
    </div>
  );
}

function SessionRow({ s }: { s: Session }) {
  const kindLabel = ({ direct: "Direct", cron: "Cron", group: "Group / Discord" } as Record<string, string>)[s.kind ?? ""] || s.kind;
  const tokens = s.totalTokens ? `${(s.totalTokens / 1000).toFixed(0)}K tokens` : "–";
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{kindLabel}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }} className="mono clip">{s.sessionId?.slice(0, 16)}…</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{tokens}</div>
        <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{relTime(s.updatedAt)}</div>
      </div>
    </div>
  );
}

// ── Chat history helpers ────────────────────────────────────────────────────
function chatHistoryKey(agentId: string) { return "jarvis:chat:" + agentId; }

function loadChatHistory(agentId: string): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(chatHistoryKey(agentId)) || "[]"); } catch { return []; }
}

function saveChatHistory(agentId: string, sessions: ChatSession[]) {
  try { localStorage.setItem(chatHistoryKey(agentId), JSON.stringify(sessions.slice(-50))); } catch {}
}

function newChatSession(agentId: string): ChatSession {
  return { id: "jarvisapp-" + Date.now().toString(36), agentId, createdAt: Date.now(), messages: [] };
}

// ── Chat history list view ──────────────────────────────────────────────────
function ChatHistory({ agent, sessions, onSelect, onNew, onClose }: {
  agent: Agent; sessions: ChatSession[]; onSelect: (s: ChatSession) => void; onNew: () => void; onClose: () => void;
}) {
  return (
    <div className="screen anim-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Header title="Chat History" sub={agent.name} onBack={onClose}
        right={
          <button className="tap" onClick={onNew}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 100,
              background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 660 }}>
            <Icon name="plus" size={14} stroke={2.5} />New Chat
          </button>
        }
      />
      <div className="pad" style={{ flex: 1, overflowY: "auto" }}>
        {sessions.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-ghost)", fontSize: 14 }}>
            No previous chats. Start one!
          </div>
        )}
        {sessions.slice().reverse().map(function(s) {
          const preview = s.messages.length ? s.messages[s.messages.length - 1].text.slice(0, 80) : "Empty chat";
          const dateStr = new Date(s.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          return (
            <button key={s.id} className="tap card" onClick={function() { onSelect(s); }}
              style={{ width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: 10, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{dateStr}</span>
                <span style={{ fontSize: 11, color: "var(--text-ghost)", background: "var(--surface-2)", borderRadius: 100, padding: "2px 8px" }}>
                  {s.messages.length} msg{s.messages.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.4 }} className="clip">{preview}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AgentChat ──────────────────────────────────────────────────────────
function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  // Chat sessions persisted to localStorage
  const [sessions, setSessions] = useState(function() { return loadChatHistory(agent.id); });
  const [activeSession, setActiveSession] = useState(function() {
    const hist = loadChatHistory(agent.id);
    return hist.length ? hist[hist.length - 1] : newChatSession(agent.id);
  });
  const [showHistory, setShowHistory] = useState(false);

  const [input, setInput] = useState("");
  const chat = useAgentChat();
  const sending = chat.isPending;
  const [error, setError] = useState<string | null>(null);
  const sessionKeyRef = useRef("agent:" + agent.id + ":" + (activeSession.id));
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep sessionKey in sync when active session changes
  useEffect(function() {
    sessionKeyRef.current = "agent:" + agent.id + ":" + activeSession.id;
    setError(null);
  }, [agent.id, activeSession.id]);

  useEffect(function() {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, sending]);

  function persistSession(updated: ChatSession) {
    setSessions(function(prev) {
      const idx = prev.findIndex(function(s) { return s.id === updated.id; });
      let next: ChatSession[];
      if (idx >= 0) { next = prev.slice(); next[idx] = updated; }
      else { next = prev.concat(updated); }
      saveChatHistory(agent.id, next);
      return next;
    });
  }

  function startNewChat() {
    const s = newChatSession(agent.id);
    setActiveSession(s);
    setShowHistory(false);
    setError(null);
    setInput("");
  }

  function openSession(s: ChatSession) {
    setActiveSession(s);
    setShowHistory(false);
    setError(null);
    setInput("");
  }

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    const userMsg: ChatMessage = { role: "user", text, id: Date.now() };
    const updated = { ...activeSession, messages: activeSession.messages.concat(userMsg) };
    setActiveSession(updated);
    persistSession(updated);

    chat.mutate({ agentId: agent.id, message: text, sessionKey: sessionKeyRef.current }, {
      onSuccess(data) {
        const agentMsg: ChatMessage = { role: "agent", text: replyText(data), id: Date.now() + 1 };
        setActiveSession(function(prev) {
          const next = { ...prev, messages: prev.messages.concat(agentMsg) };
          persistSession(next);
          return next;
        });
      },
      onError(e) {
        setError(e.message === "Failed to fetch" ? "Network error — is the server running?" : e.message);
      },
    });
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (showHistory) {
    return <ChatHistory agent={agent} sessions={sessions} onSelect={openSession} onNew={startNewChat} onClose={function() { setShowHistory(false); }} />;
  }

  const messages = activeSession.messages;

  return (
    <div className="screen anim-screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Header
        title={agent.name}
        sub={<span className="mono" style={{ fontSize: 11 }}>{agent.model}</span>}
        onBack={onClose}
        right={
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <button className="tap" onClick={function() { setShowHistory(true); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
                background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
              <Icon name="clock" size={13} stroke={2} />
              History
            </button>
            <button className="tap" onClick={startNewChat}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
                background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 660, border: "none" }}>
              <Icon name="plus" size={13} stroke={2.5} />
              New
            </button>
          </div>
        }
      />

      {/* Model badge — read only, model is set in agent config */}
      <div style={{ padding: "0 18px 10px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
          background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
          <Icon name="brain" size={13} stroke={2} />
          <span className="mono">{agent.model}</span>
        </div>
      </div>

      {/* Empty state */}
      {messages.length === 0 && !sending && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={64} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, marginBottom: 6 }}>{agent.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>
              Running <span className="mono">{agent.model}</span> via {agent.modelProvider}.<br />
              Send a message to start a conversation.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {["What can you help me with?", "Summarise recent activity", "What's in my workspace?"].map(function(q) {
              return (
                <button key={q} className="tap" onClick={function() { setInput(q); if (inputRef.current) inputRef.current.focus(); }}
                  style={{ padding: "8px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 560,
                    background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
                  {q}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      {(messages.length > 0 || sending) && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map(function(msg) {
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
                {msg.role === "agent" && (
                  <div style={{ flexShrink: 0, marginBottom: 2 }}>
                    <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={28} />
                  </div>
                )}
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? "var(--accent)" : "var(--surface)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                  fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          {sending && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={28} />
              <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "var(--surface)", display: "flex", gap: 5, alignItems: "center" }}>
                {[0,1,2].map(function(i) {
                  return <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-ghost)",
                    animation: "pulse 1.2s ease-in-out " + (i*0.2) + "s infinite" }} />;
                })}
              </div>
            </div>
          )}
          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon name="warn" size={15} stroke={2} style={{ color: "var(--err)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "var(--err)", lineHeight: 1.4 }}>{error}</span>
            </div>
          )}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: "12px 18px calc(20px + 80px + env(safe-area-inset-bottom, 0px))", borderTop: messages.length ? "1px solid var(--border)" : "none", background: "var(--bg)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--surface)", borderRadius: 20, padding: "8px 8px 8px 16px", border: "1px solid var(--border-strong)" }}>
          <textarea ref={inputRef} value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={handleKey}
            placeholder={"Message " + agent.name + "…"} rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5,
              fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.5, paddingTop: 2 }} />
          <button className="tap" onClick={send} disabled={!input.trim() || sending}
            style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() && !sending ? "var(--accent)" : "var(--surface-2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              color: input.trim() && !sending ? "#fff" : "var(--text-ghost)", transition: "background 0.15s" }}>
            <Icon name="send" size={17} stroke={2.2} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-ghost)", textAlign: "center", marginTop: 7 }}>
          Messages go via <span className="mono">openclaw agent</span> · responses may take 10–60s
        </div>
      </div>
    </div>
  );
}

function AgentDetail({ agent, onClose, onChat }: { agent: Agent; onClose: () => void; onChat: () => void }) {
  const tabs = ["overview", "sessions", "crons"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
  const recentSessions = (agent.sessions || []).slice(0, 10);
  return (
    <div className="screen pad-b anim-screen">
      <Header title={agent.name} sub={`${agent.model} · ${agent.modelProvider}`} onBack={onClose}
        right={
          <button className="tap" onClick={onChat}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 100,
              background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 660 }}>
            <Icon name="message" size={14} stroke={2.2} />
            Chat
          </button>
        }
      />
      <div style={{ display: "flex", gap: 8, padding: "0 18px 14px", overflowX: "auto", scrollbarWidth: "none" }}>
        {tabs.map(t => (
          <button key={t} className="tap" onClick={() => setTab(t)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
            background: tab === t ? "var(--accent)" : "var(--surface)", color: tab === t ? "#fff" : "var(--text-dim)", border: tab === t ? "none" : "1px solid var(--border)" }}>{t}</button>
        ))}
      </div>
      <div className="pad">
        {tab === "overview" && (
          <div>
            <div className="card" style={{ padding: 18, marginBottom: 14, display: "flex", gap: 16, alignItems: "center" }}>
              <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={56} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>{agent.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 3 }}>ID: <span className="mono">{agent.id}</span></div>
                <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 2 }}>Model: <span className="mono">{agent.model}</span></div>
              </div>
            </div>
            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              {([
                ["Status", <span style={{ color: agent.status === "running" ? "var(--ok)" : "var(--text-dim)", textTransform: "capitalize" }}>{agent.status}</span>],
                ["Last Active", agent.last],
                ["Sessions", agent.sessionCount],
                ["Cron Jobs", agent.cronCount],
                ["Bindings", agent.bindings],
                ["Default", agent.isDefault ? "Yes" : "No"],
              ] as [string, ReactNode][]).map(([k, v]) => (
                <div key={k} className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 580 }}>{v}</span>
                </div>
              ))}
            </div>
            {agent.workspace && (
              <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", marginBottom: 6 }}>WORKSPACE</div>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--text-dim)", wordBreak: "break-all" }}>{agent.workspace}</span>
              </div>
            )}
            {/* Start agent button */}
            <button className="tap" onClick={onChat}
              style={{ width: "100%", padding: 16, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: "linear-gradient(135deg, rgba(91,140,255,0.18), rgba(167,121,255,0.14))",
                border: "1px solid var(--border-strong)", color: "var(--accent)", fontWeight: 660, fontSize: 14.5 }}>
              <Icon name="play" size={18} stroke={2} />
              {agent.status === "running" ? "Open Chat" : "Start / Chat with Agent"}
            </button>
          </div>
        )}
        {tab === "sessions" && (
          <div className="card" style={{ padding: "0 14px" }}>
            {recentSessions.length ? recentSessions.map(s => <SessionRow key={s.sessionId} s={s} />) : <div style={{ padding: 20, color: "var(--text-ghost)", textAlign: "center", fontSize: 13 }}>No sessions</div>}
          </div>
        )}
        {tab === "crons" && (
          <div className="card" style={{ padding: "0 14px" }}>
            {(agent.crons || []).length ? (agent.crons || []).map(c => <CronJobRow key={c.id} job={c} />) : <div style={{ padding: 20, color: "var(--text-ghost)", textAlign: "center", fontSize: 13 }}>No cron jobs</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Agents(_: ScreenProps) {
  const d = useData();
  const [selected, setSelected] = useState<Agent | null>(null);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const allAgents = d.agents;
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Running", "Idle"];
  const list = allAgents.filter(a => filter === "All" || a.status === filter.toLowerCase());

  if (chatAgent) return <AgentChat agent={chatAgent} onClose={() => setChatAgent(null)} />;
  if (selected) return <AgentDetail agent={selected} onClose={() => setSelected(null)} onChat={() => { setChatAgent(selected); setSelected(null); }} />;

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Agents" sub={`${allAgents.length} deployed`} right={<ConnectionBadge />} />
      <OfflineBanner pageName="Agents" />
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "0 18px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { label: "Agents", value: allAgents.length, tone: "var(--accent)" },
          { label: "Sessions", value: d.sessions.length, tone: "var(--purple)" },
          { label: "Cron Jobs", value: d.crons.length, tone: "var(--cyan)" },
        ].map(({ label, value, tone }) => (
          <div key={label} className="card" style={{ flexShrink: 0, padding: "10px 16px", minWidth: 90, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 740, color: tone, letterSpacing: -1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 14px", scrollbarWidth: "none" }}>
        {filters.map(f => (
          <button key={f} className="tap" onClick={() => setFilter(f)} style={{ flexShrink: 0, padding: "8px 15px", borderRadius: 100, fontSize: 13, fontWeight: 600,
            background: filter === f ? "var(--accent)" : "var(--surface)", color: filter === f ? "#fff" : "var(--text-dim)", border: filter === f ? "none" : "1px solid var(--border)" }}>{f}</button>
        ))}
      </div>
      <div className="pad grid-cards" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {list.length ? list.map(a => <AgentCard key={a.id} a={a} onClick={() => setSelected(a)} />) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)", fontSize: 14, gridColumn: "1 / -1" }}>No agents match filter</div>
        )}
      </div>
    </div>
  );
}
