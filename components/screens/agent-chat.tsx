"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AgentEmoji } from "@/components/ui/agent-emoji";
import { Markdown } from "@/components/ui/markdown";
import { Header, Icon, Pill, Sheet } from "@/components/ui/primitives";
import {
  addPending, appendMessage, clearUnread, latestSession, newChatSession, removeMessage, saveSession, syncFromServer,
  useChatSessions, usePendingReplies, type ChatMessage, type ChatSession,
} from "@/lib/chat-store";
import { startChat, stopChat, useData, useModelConfig, useServerChatMessages, useServerChats, type AppChatSummary } from "@/lib/queries";
import type { Agent, Model } from "@/lib/types";

const sessionKey = (agentId: string, sessionId: string) => `agent:${agentId}:${sessionId}`;

// App chats default to a cloud model: the local 3B model often answers with a tool call instead of text.
// Each chat can still pick any allowed model; agents' scheduled jobs keep their own model.
const APP_CHAT_MODEL = "google/gemini-2.5-flash";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {} t.remove();
    }
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <button className="tap" onClick={() => void copy()} title="Copy reply"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: done ? "var(--ok)" : "var(--text-ghost)", padding: "2px 4px" }}>
      <Icon name={done ? "check" : "copy"} size={12} stroke={2} />{done ? "Copied" : "Copy"}
    </button>
  );
}

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

interface ChatEntry { id: string; updatedAt: number; count: number; preview: string }

// This browser's chats plus the ones OpenClaw has from other devices, newest first
function mergeChats(local: ChatSession[], server: AppChatSummary[]): ChatEntry[] {
  const byId = new Map<string, ChatEntry>();
  for (const s of local) {
    const last = s.messages.at(-1);
    byId.set(s.id, { id: s.id, updatedAt: s.updatedAt ?? s.createdAt, count: s.messages.length, preview: last ? last.text.slice(0, 120) : "Empty chat" });
  }
  for (const c of server) {
    const mine = byId.get(c.id);
    if (!mine || c.updatedAt >= mine.updatedAt) byId.set(c.id, { id: c.id, updatedAt: Math.max(c.updatedAt, mine?.updatedAt ?? 0), count: Math.max(c.count, mine?.count ?? 0), preview: c.preview || mine?.preview || "" });
  }
  return [...byId.values()].filter(c => c.count > 0).sort((a, b) => b.updatedAt - a.updatedAt);
}

function ChatHistory({ agent, chats, onSelect, onNew, onClose }: {
  agent: Agent; chats: ChatEntry[]; onSelect: (id: string) => void; onNew: () => void; onClose: () => void;
}) {
  const sorted = chats;
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
          const preview = s.preview.slice(0, 80) || "Empty chat";
          const dateStr = new Date(s.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          return (
            <button key={s.id} className="tap card" onClick={() => onSelect(s.id)}
              style={{ width: "100%", textAlign: "left", padding: "14px 16px", marginBottom: 10, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text-ghost)" }}>{dateStr}</span>
                <span style={{ fontSize: 11, color: "var(--text-ghost)", background: "var(--surface-2)", borderRadius: 100, padding: "2px 8px" }}>
                  {s.count} msg{s.count !== 1 ? "s" : ""}
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
  const serverChats = useServerChats(agent.id);

  // Open the conversation with the latest activity; a new chat is a draft until its first message
  const [activeId, setActiveId] = useState(() => latestSession(sessions)?.id ?? null);
  const [draft, setDraft] = useState<ChatSession>(() => newChatSession(agent.id));
  // A chat that so far exists only in OpenClaw (from another device) shows up once its messages load
  const active = sessions.find(s => s.id === activeId) ?? (activeId ? { id: activeId, agentId: agent.id, createdAt: Date.now(), messages: [] } : draft);

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
  const chatModels = modelCfg?.chatModels ?? [];
  // Until OpenClaw's model list loads, assume the app default is allowed (it's checked server-side)
  const appDefault = !chatModels.length || chatModels.includes(APP_CHAT_MODEL) ? APP_CHAT_MODEL : defaultModel;
  const currentModel = active.model ?? appDefault;

  // OpenClaw's transcript is the source of truth; refresh it when a reply lands
  const saved = !!activeId;
  const serverMsgs = useServerChatMessages(agent.id, active.id, saved);
  useEffect(() => {
    if (serverMsgs.data) syncFromServer(agent.id, active.id, serverMsgs.data.messages);
  }, [serverMsgs.data, agent.id, active.id]);
  const wasPending = useRef(false);
  const refetchAll = useRef(() => {});
  refetchAll.current = () => { void serverMsgs.refetch(); void serverChats.refetch(); };
  useEffect(() => {
    if (wasPending.current && !pending) refetchAll.current();
    wasPending.current = !!pending;
  }, [pending]);
  // Nothing in this browser yet: open the latest chat from another device
  const pickedServer = useRef(false);
  useEffect(() => {
    const latest = serverChats.data?.chats.find(c => c.count > 0);
    if (pickedServer.current || activeId || draft.messages.length || !latest) return;
    pickedServer.current = true;
    setActiveId(latest.id);
  }, [serverChats.data, activeId, draft.messages.length]);
  const current = currentModel ? describeModel(currentModel, models) : { name: agent.model, where: agent.modelProvider === "ollama" ? "On this Mac" : "Cloud" };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length, waiting]);

  // Opening the chat (or a reply landing while it's open) marks this agent's replies as read
  useEffect(() => { clearUnread(agent.id); }, [agent.id, sessions]);

  function openSession(id: string) {
    setActiveId(id); setShowHistory(false); setInput("");
  }

  function startNewChat() {
    const s = newChatSession(agent.id);
    s.model = active.model; // keep the chosen model for the next conversation
    setDraft(s); setActiveId(null); setShowHistory(false); setInput("");
  }

  function chooseModel(id: string) {
    const model = id === appDefault ? null : id;
    if (sessions.some(s => s.id === active.id)) saveSession({ ...active, model });
    else setDraft({ ...active, model });
    setPickModel(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || waiting) return;
    setInput("");
    await dispatch(text, { ...active, messages: [...active.messages, { role: "user", text, id: Date.now() }] });
  }

  // Ask again after a failure: drop the error and resend the question before it
  async function retry(errorMsg: ChatMessage) {
    if (waiting) return;
    const idx = active.messages.findIndex(m => m.id === errorMsg.id);
    const question = [...active.messages.slice(0, idx)].reverse().find(m => m.role === "user");
    if (!question) return;
    removeMessage(agent.id, active.id, errorMsg.id);
    await dispatch(question.text, { ...active, messages: active.messages.filter(m => m.id !== errorMsg.id) });
  }

  async function stop() {
    if (pending) { try { await stopChat(pending.jobId); } catch {} }
  }

  async function dispatch(text: string, session: ChatSession) {
    requestNotifyPermission();
    saveSession(session);
    setActiveId(session.id);
    setStarting(true);
    try {
      const { job } = await startChat({ agentId: agent.id, message: text, sessionKey: sessionKey(agent.id, session.id), model: session.model ?? appDefault });
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
    return <ChatHistory agent={agent} chats={mergeChats(sessions, serverChats.data?.chats ?? [])} onSelect={openSession} onNew={startNewChat} onClose={() => setShowHistory(false)} />;
  }

  const messages = active.messages;
  const elapsed = pending ? now - pending.startedAt : 0;
  const pendingModel = pending?.model ?? appDefault;
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
                  fontSize: 14, lineHeight: 1.5, whiteSpace: msg.role === "agent" && !msg.error ? "normal" : "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.error && <Icon name="warn" size={14} stroke={2} style={{ verticalAlign: -2, marginRight: 6 }} />}
                  {msg.role === "agent" && !msg.error ? <Markdown text={msg.text} /> : msg.text}
                </div>
                {msg.role === "agent" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, marginLeft: 2 }}>
                    {msg.model && <span className="mono" style={{ fontSize: 10.5, color: "var(--text-ghost)" }}>{msg.model}</span>}
                    {!msg.error && <CopyButton text={msg.text} />}
                    {msg.error && msg === messages.at(-1) && (
                      <button className="tap" onClick={() => void retry(msg)} disabled={waiting}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 620, color: "var(--accent)", padding: "2px 4px" }}>
                        <Icon name="refresh" size={12} stroke={2.2} />Retry
                      </button>
                    )}
                  </div>
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
          {pending ? (
            <button className="tap" onClick={() => void stop()} title="Stop this reply"
              style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border-strong)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text)" }}>
              <Icon name="stop" size={14} stroke={2.4} fill="currentColor" />
            </button>
          ) : (
            <button className="tap" onClick={() => void send()} disabled={!input.trim() || waiting}
              style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() && !waiting ? "var(--accent)" : "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                color: input.trim() && !waiting ? "#fff" : "var(--text-ghost)", transition: "background 0.15s" }}>
              <Icon name="send" size={17} stroke={2.2} />
            </button>
          )}
        </div>
      </div>

      <Sheet open={pickModel} onClose={() => setPickModel(false)} title="Model for this chat">
        <p style={{ fontSize: 13, color: "var(--text-faint)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Only changes this conversation. New chats start on <span className="mono">{appDefault?.replace(/^[^/]+\//, "")}</span>;
          {" "}{agent.name}&apos;s scheduled jobs keep their own model (<span className="mono">{defaultModel?.replace(/^[^/]+\//, "")}</span> by default).
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
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>{d.where}{id === appDefault ? " · default for app chats" : id === defaultModel ? " · agent default" : ""}</div>
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
