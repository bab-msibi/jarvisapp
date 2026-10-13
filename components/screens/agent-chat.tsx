"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AgentEmoji } from "@/components/ui/agent-emoji";
import { Header, Icon, Pill, Sheet } from "@/components/ui/primitives";
import {
  addPending, appendMessage, latestSession, newChatSession, saveSession, useChatSessions, usePendingReplies, type ChatSession,
} from "@/lib/chat-store";
import { startChat, useData, useModelConfig } from "@/lib/queries";
import type { Agent, Model } from "@/lib/types";

const sessionKey = (agentId: string, sessionId: string) => `agent:${agentId}:${sessionId}`;

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// "qwen2.5:3b" + where it runs, for the model chip and picker
function describeModel(id: string, models: Model[]) {
  const name = id.replace(/^[^/]+\//, "");
  const m = models.find((x) => x.id === id);
  const local = m ? m.family.startsWith("Local") : id.startsWith("ollama/");
  return { name, where: local ? "On this Mac" : "Cloud" };
}

// Ask once, on a user gesture, so a reply can raise a notification while Jarvis is in the background
function requestNotifyPermission() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
}

function ChatHistory({ agent, sessions, onSelect, onNew, onClose }: {
  agent: Agent; sessions: ChatSession[]; onSelect: (s: ChatSession) => void; onNew: () => void; onClose: () => void;
}) {
  const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
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
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-ghost)", fontSize: 14 }}>No previous chats. Start one!</div>
        )}
        {sorted.map(s => {
          const preview = s.messages.length ? s.messages[s.messages.length - 1].text.slice(0, 80) : "Empty chat";
          const dateStr = new Date(s.updatedAt ?? s.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          return (
            <button key={s.id} className="tap card" onClick={() => onSelect(s)}
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

export function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const sessions = useChatSessions(agent.id);
  const pendingAll = usePendingReplies();
  const { models } = useData();
  const { data: modelCfg } = useModelConfig();

  // Open the conversation with the latest activity; a new chat is a draft until its first message
  const [activeId, setActiveId] = useState(() => latestSession(sessions)?.id ?? null);
  const [draft, setDraft] = useState<ChatSession>(() => newChatSession(agent.id));
  const active = sessions.find(s => s.id === activeId) ?? draft;

  const [showHistory, setShowHistory] = useState(false);
  const [pickModel, setPickModel] = useState(false);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pending = pendingAll.find(p => p.sessionId === active.id);
  const waiting = !!pending || starting;
  const now = useNow(!!pending);
  const defaultModel = modelCfg?.defaultModel ?? null;
  const currentModel = active.model ?? defaultModel; // null until the config loads
  const chatModels = modelCfg?.chatModels ?? [];
  // Until OpenClaw's model config loads, show the agent's own model (from the agent list)
  const current = currentModel ? describeModel(currentModel, models) : { name: agent.model, where: agent.modelProvider === "ollama" ? "On this Mac" : "Cloud" };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length, waiting]);

  function openSession(s: ChatSession) {
    setActiveId(s.id); setShowHistory(false); setInput("");
  }

  function startNewChat() {
    const s = newChatSession(agent.id);
    s.model = active.model; // keep the chosen model for the next conversation
    setDraft(s); setActiveId(null); setShowHistory(false); setInput("");
  }

  function chooseModel(id: string) {
    const model = id === defaultModel ? null : id;
    if (sessions.some(s => s.id === active.id)) saveSession({ ...active, model });
    else setDraft({ ...active, model });
    setPickModel(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || waiting) return;
    requestNotifyPermission();
    setInput("");
    const session: ChatSession = { ...active, messages: [...active.messages, { role: "user", text, id: Date.now() }] };
    saveSession(session);
    setActiveId(session.id);
    setStarting(true);
    try {
      const { job } = await startChat({ agentId: agent.id, message: text, sessionKey: sessionKey(agent.id, session.id), model: session.model });
      addPending({ jobId: job.id, agentId: agent.id, sessionId: session.id, startedAt: job.startedAt, model: job.model });
    } catch (e) {
      // Saved into the conversation (not just shown) so it's still there if you've left the chat
      const msg = (e as Error).message;
      appendMessage(agent.id, session.id, {
        role: "agent", id: Date.now(), error: true,
        text: `Couldn't send: ${msg === "Failed to fetch" ? "Jarvis isn't reachable right now. Try again in a moment." : msg}`,
      });
    } finally {
      setStarting(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  if (showHistory) {
    return <ChatHistory agent={agent} sessions={sessions} onSelect={openSession} onNew={startNewChat} onClose={() => setShowHistory(false)} />;
  }

  const messages = active.messages;
  const elapsed = pending ? now - pending.startedAt : 0;
  const pendingModel = pending?.model ?? defaultModel;
  const pendingLocal = pendingModel ? describeModel(pendingModel, models).where === "On this Mac" : true;

  return (
    <div className="screen anim-screen" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header
        title={agent.name}
        sub={<span className="mono" style={{ fontSize: 11 }}>{current.name}</span>}
        onBack={onClose}
        right={
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <button className="tap" onClick={() => setShowHistory(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
                background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
              <Icon name="clock" size={13} stroke={2} />History
            </button>
            <button className="tap" onClick={startNewChat}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 100,
                background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 660, border: "none" }}>
              <Icon name="plus" size={13} stroke={2.5} />New
            </button>
          </div>
        }
      />

      {/* Model for this conversation — tap to switch (only models OpenClaw allows for this agent) */}
      <div style={{ padding: "0 18px 10px" }}>
        <button className="tap" onClick={() => setPickModel(true)} disabled={chatModels.length < 2}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 100,
            background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
          <Icon name="brain" size={13} stroke={2} />
          <span className="mono">{current.name}</span>
          <span style={{ color: "var(--text-ghost)", fontWeight: 500 }}>· {current.where}</span>
          {chatModels.length > 1 && <Icon name="chevD" size={13} stroke={2} />}
        </button>
      </div>

      {messages.length === 0 && !waiting && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={64} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, marginBottom: 6 }}>{agent.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.5 }}>
              Send a message to start a conversation.<br />You can leave this screen while it replies.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {["What can you help me with?", "Summarise recent activity", "What's in my workspace?"].map(q => (
              <button key={q} className="tap" onClick={() => { setInput(q); inputRef.current?.focus(); }}
                style={{ padding: "8px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 560,
                  background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {(messages.length > 0 || waiting) && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
              {msg.role === "agent" && (
                <div style={{ flexShrink: 0, marginBottom: 2 }}>
                  <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={28} />
                </div>
              )}
              <div style={{ maxWidth: "78%", minWidth: 0 }}>
                <div style={{
                  padding: "10px 14px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? "var(--accent)" : msg.error ? "rgba(239,68,68,0.08)" : "var(--surface)",
                  border: msg.error ? "1px solid rgba(239,68,68,0.25)" : undefined,
                  color: msg.role === "user" ? "#fff" : msg.error ? "var(--err)" : "var(--text)",
                  fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.error && <Icon name="warn" size={14} stroke={2} style={{ verticalAlign: -2, marginRight: 6 }} />}
                  {msg.text}
                </div>
                {msg.role === "agent" && msg.model && (
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-ghost)", marginTop: 4, marginLeft: 4 }}>{msg.model}</div>
                )}
              </div>
            </div>
          ))}
          {waiting && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <AgentEmoji emoji={agent.emoji} name={agent.name} color={agent.color} size={28} />
              <div style={{ padding: "11px 14px", borderRadius: "18px 18px 18px 4px", background: "var(--surface)", maxWidth: "78%" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-ghost)", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{pending ? fmtElapsed(elapsed) : "sending…"}</span>
                </div>
                {pending && elapsed > (pendingLocal ? 20000 : 30000) && (
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 7, lineHeight: 1.45 }}>
                    {pendingLocal ? "Local models on this Mac can take a minute or two. " : "Still working. "}
                    You can leave this screen — you'll get a notice when {agent.name} replies.
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} style={{ height: 1 }} />
        </div>
      )}

      <div style={{ padding: "12px 18px calc(14px + env(safe-area-inset-bottom, 0px))", borderTop: messages.length ? "1px solid var(--border)" : "none", background: "var(--bg)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--surface)", borderRadius: 20, padding: "8px 8px 8px 16px", border: "1px solid var(--border-strong)" }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={waiting ? `${agent.name} is replying…` : `Message ${agent.name}…`} rows={1}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5,
              fontFamily: "inherit", resize: "none", maxHeight: 120, lineHeight: 1.5, paddingTop: 2 }} />
          <button className="tap" onClick={() => void send()} disabled={!input.trim() || waiting}
            style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() && !waiting ? "var(--accent)" : "var(--surface-2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              color: input.trim() && !waiting ? "#fff" : "var(--text-ghost)", transition: "background 0.15s" }}>
            <Icon name="send" size={17} stroke={2.2} />
          </button>
        </div>
      </div>

      <Sheet open={pickModel} onClose={() => setPickModel(false)} title="Model for this chat">
        <p style={{ fontSize: 13, color: "var(--text-faint)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Only changes this conversation. {agent.name}&apos;s default and scheduled jobs keep using <span className="mono">{defaultModel?.replace(/^[^/]+\//, "")}</span>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {chatModels.map(id => {
            const d = describeModel(id, models);
            const on = id === currentModel;
            return (
              <button key={id} className="tap card" onClick={() => chooseModel(id)}
                style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, textAlign: "left", width: "100%", border: on ? "1px solid var(--accent)" : undefined }}>
                <Icon name={d.where === "Cloud" ? "cloud" : "monitor"} size={18} stroke={1.9} style={{ color: d.where === "Cloud" ? "var(--cyan)" : "var(--purple)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono clip" style={{ fontSize: 13.5, fontWeight: 620 }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>{d.where}{id === defaultModel ? " · agent default" : ""}</div>
                </div>
                {on && <Pill tone="ok">Selected</Pill>}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
