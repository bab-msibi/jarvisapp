"use client";

import { useState, type ReactNode } from "react";
import { AgentChat } from "@/components/screens/agent-chat";
import { AgentEmoji } from "@/components/ui/agent-emoji";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Dot, Header, Icon, Pill, TopBar, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";
import type { Agent, CronJob, Session } from "@/lib/types";

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

// Agent detail and chat are overlay screens addressed by agent id, so they have
// their own URLs and the browser back button steps out of them
function AgentNotFound({ nav, loading }: ScreenProps & { loading: boolean }) {
  return (
    <div className="screen" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Agent" />
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)", fontSize: 14 }}>
        {loading ? "Loading…" : `No agent called “${nav.params.id}”`}
      </div>
    </div>
  );
}

export function AgentDetailScreen({ nav }: ScreenProps) {
  const { agents, loading } = useData();
  const agent = agents.find(a => a.id === nav.params.id);
  if (!agent) return <AgentNotFound nav={nav} loading={loading} />;
  return <AgentDetail agent={agent} onClose={nav.pop} onChat={() => nav.push("agentChat", { id: agent.id })} />;
}

export function AgentChatScreen({ nav }: ScreenProps) {
  const { agents, loading } = useData();
  const agent = agents.find(a => a.id === nav.params.id);
  if (!agent) return <AgentNotFound nav={nav} loading={loading} />;
  return <AgentChat key={agent.id} agent={agent} onClose={nav.pop} />;
}

export function Agents({ nav }: ScreenProps) {
  const d = useData();
  const allAgents = d.agents;
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Running", "Idle"];
  const list = allAgents.filter(a => filter === "All" || a.status === filter.toLowerCase());


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
        {list.length ? list.map(a => <AgentCard key={a.id} a={a} onClick={() => nav.push("agentDetail", { id: a.id })} />) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)", fontSize: 14, gridColumn: "1 / -1" }}>No agents match filter</div>
        )}
      </div>
    </div>
  );
}
