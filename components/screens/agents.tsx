"use client";

import { useState, type ReactNode } from "react";
import { AgentChat } from "@/components/screens/agent-chat";
import { AgentEmoji } from "@/components/ui/agent-emoji";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Btn, Dot, Header, Icon, Pill, Sheet, TopBar, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import { cronText, whenText } from "@/lib/cron-format";
import type { ScreenProps } from "@/lib/nav";
import { useCronAction, useCronRuns, useData, useModelConfig } from "@/lib/queries";
import { contextPct, fmtTokens, sessionTitle, sessionTokens } from "@/lib/sessions";
import type { CronRun } from "@/lib/server/cron";
import type { Agent, CronJob, Session } from "@/lib/types";

const nextCron = (a: Agent) =>
  a.crons.filter(c => c.enabled !== false && c.state?.nextRunAtMs).sort((x, y) => x.state!.nextRunAtMs! - y.state!.nextRunAtMs!)[0];

function AgentCard({ a, onClick }: { a: Agent; onClick: () => void }) {
  const statusColor = ({ running: "var(--ok)", idle: "var(--text-ghost)", paused: "var(--warn)", error: "var(--err)" } as Record<string, string>)[a.status] || "var(--text-ghost)";
  const cronBadge = a.cronCount > 0 ? `${a.cronCount} cron` : null;
  const sessBadge = `${a.sessionCount} sessions`;
  const next = nextCron(a);
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

      {/* What it's doing now, or what's next */}
      <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 13, padding: "9px 12px", background: "var(--surface-2)", borderRadius: 10,
        color: a.task ? "var(--ok)" : "var(--text-dim)" }} className="clip">
        {a.task || (next ? `Next: ${next.name} · ${whenText(next.state?.nextRunAtMs)}` : "Idle · nothing scheduled")}
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

// A raw JSON tool call (or nothing) instead of text usually means the model couldn't use its tools
function badOutput(r: CronRun) {
  const t = (r.summary || "").trim();
  if (!t) return "No output";
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      if (j && typeof j === "object") return j.arguments ? "Output is a raw tool call, not a post" : j.status === "error" || j.error ? "Output is a tool error, not a post" : "Output is raw JSON, not a post";
    } catch {}
  }
  return null;
}

function RunRow({ r, last }: { r: CronRun; last: boolean }) {
  const [open, setOpen] = useState(false);
  const bad = badOutput(r);
  const failed = r.status && r.status !== "ok";
  const tone: Tone = failed ? "err" : bad ? "warn" : "ok";
  const tokens = r.usage ? (r.usage.input_tokens ?? 0) + (r.usage.output_tokens ?? 0) : 0;
  const where = r.delivery?.resolved?.channel;
  return (
    <div style={{ padding: "9px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <button className="tap" onClick={() => setOpen(o => !o)} style={{ width: "100%", textAlign: "left", display: "block" }}>
        <div className="between" style={{ gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{whenText(r.runAtMs ?? r.ts)}</span>
          <Pill tone={tone} style={{ fontSize: 10 }}>{failed ? r.status : bad ? "check output" : "ok"}</Pill>
        </div>
        <div className="clip" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
          {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : "–"}
          {r.model ? ` · ${r.model}` : ""}
          {tokens ? ` · ${fmtTokens(tokens)} tokens` : ""}
          {r.delivered ? ` · sent to ${where || "channel"}` : r.deliveryStatus ? ` · ${r.deliveryStatus}` : ""}
        </div>
        {(bad || r.error) && <div style={{ fontSize: 11.5, color: failed ? "var(--err)" : "var(--warn)", marginTop: 3 }}>{r.error || bad}</div>}
      </button>
      {open && (
        <pre className="mono" style={{ margin: "8px 0 2px", padding: 10, borderRadius: 10, background: "var(--surface-2)", fontSize: 11, lineHeight: 1.45,
          whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflow: "auto", color: "var(--text-dim)" }}>{r.summary || r.error || "(no output)"}</pre>
      )}
    </div>
  );
}

type CronActionHook = ReturnType<typeof useCronAction>;

// The confirm / model sheets live on the agent screen (outside the animated .pad, whose
// transform would otherwise anchor them off-screen); rows just ask for them
function CronJobRow({ job, agentModel, action, onAskRun, onAskModel }: {
  job: CronJob; agentModel: string; action: CronActionHook; onAskRun: () => void; onAskModel: () => void;
}) {
  const [history, setHistory] = useState(false);
  const runs = useCronRuns(job.id, history);
  const mine = action.variables?.id === job.id;
  const enabled = job.enabled !== false;
  const status = job.state?.lastRunStatus;
  const consecutive = job.state?.consecutiveErrors || 0;
  const tone: Tone = !enabled ? "neutral" : status === "error" ? "err" : status === "ok" ? "ok" : "neutral";
  const model = job.payload?.model;
  const act = (a: "enable" | "disable") => job.id && action.mutate({ id: job.id, action: a });
  const smallBtn = { display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 9, fontSize: 12, fontWeight: 620,
    background: "var(--surface-2)", color: "var(--text-dim)" } as const;

  return (
    <div style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="between" style={{ marginBottom: 5, gap: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 650, opacity: enabled ? 1 : 0.6 }}>{job.name}</span>
        <Pill tone={tone} style={{ fontSize: 10 }}>{!enabled ? "disabled" : `${status || "never run"}${consecutive > 1 ? ` ×${consecutive}` : ""}`}</Pill>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
        {cronText(job.schedule?.expr)}{job.schedule?.tz ? ` · ${job.schedule.tz.split("/").pop()?.replace(/_/g, " ")} time` : ""}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 3, display: "flex", flexWrap: "wrap", gap: "2px 14px" }}>
        <span>Last: {job.state?.lastRunAtMs ? whenText(job.state.lastRunAtMs) : "never"}</span>
        {enabled && job.state?.nextRunAtMs && <span>Next: {whenText(job.state.nextRunAtMs)}</span>}
        <span>Model: <span className="mono">{model ? model.split("/").pop() : `agent default (${agentModel})`}</span></span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
        <button className="tap" style={smallBtn} onClick={() => setHistory(h => !h)}>
          <Icon name="list" size={13} />{history ? "Hide runs" : "Runs"}
        </button>
        <button className="tap" style={smallBtn} disabled={action.isPending} onClick={onAskRun}>
          <Icon name="play" size={13} />Run now
        </button>
        <button className="tap" style={smallBtn} disabled={action.isPending} onClick={() => act(enabled ? "disable" : "enable")}>
          <Icon name={enabled ? "pause" : "play"} size={13} />{enabled ? "Disable" : "Enable"}
        </button>
        <button className="tap" style={smallBtn} disabled={action.isPending} onClick={onAskModel}>
          <Icon name="brain" size={13} />Model
        </button>
      </div>
      {mine && action.isPending && <div style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 6 }}>Working…</div>}
      {mine && action.error && <div style={{ fontSize: 11.5, color: "var(--err)", marginTop: 6 }}>{action.error.message}</div>}
      {mine && action.isSuccess && action.variables?.action === "run" && (
        <div style={{ fontSize: 11.5, color: "var(--ok)", marginTop: 6 }}>Started. It shows up under Runs when it finishes.</div>
      )}

      {history && (
        <div style={{ marginTop: 8, padding: "0 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
          {runs.isPending ? <div style={{ padding: 14, fontSize: 12, color: "var(--text-ghost)" }}>Loading runs…</div>
            : runs.error ? <div style={{ padding: 14, fontSize: 12, color: "var(--err)" }}>{runs.error.message}</div>
            : runs.data?.entries.length ? runs.data.entries.map((r, i, all) => <RunRow key={`${r.ts}-${i}`} r={r} last={i === all.length - 1} />)
            : <div style={{ padding: 14, fontSize: 12, color: "var(--text-ghost)" }}>No runs yet</div>}
        </div>
      )}

    </div>
  );
}

function CronSheets({ ask, agentModel, action, onClose }: {
  ask: { job: CronJob; kind: "run" | "model" } | null; agentModel: string; action: CronActionHook; onClose: () => void;
}) {
  const { data: mc } = useModelConfig();
  const job = ask?.job;
  const model = job?.payload?.model;
  const act = (a: "run" | "model", m?: string) => { if (job?.id) action.mutate({ id: job.id, action: a, model: m }); onClose(); };
  return (
    <>
      <Sheet open={ask?.kind === "run"} onClose={onClose} title="Run this job now?">
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 16 }}>
          “{job?.name}” runs on {model ? model.split("/").pop() : agentModel}
          {job?.delivery?.channel ? ` and delivers its result to ${job.delivery.channel}` : ""}, just like a scheduled run.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn full variant="glass" onClick={onClose}>Cancel</Btn>
          <Btn full icon="play" onClick={() => act("run")}>Run now</Btn>
        </div>
      </Sheet>

      <Sheet open={ask?.kind === "model"} onClose={onClose} title="Model for this job">
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 12, lineHeight: 1.45 }}>
          Scheduled jobs that research and post need a model that can use tools reliably. Small local models often can&apos;t.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(mc?.chatModels ?? []).map(m => {
            const current = model ? m === model : m.split("/").pop() === agentModel;
            return (
              <button key={m} className="tap card" disabled={current} onClick={() => act("model", m)}
                style={{ padding: "12px 14px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: current ? "1px solid var(--accent)" : undefined }}>
                <span className="mono" style={{ fontSize: 13 }}>{m}</span>
                {current && <Icon name="check" size={16} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
          {!mc && <div style={{ fontSize: 13, color: "var(--text-ghost)" }}>Loading models…</div>}
        </div>
      </Sheet>
    </>
  );
}

function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const tokens = sessionTokens(s);
  const ctx = contextPct(s);
  return (
    <button className="tap" onClick={onOpen} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clip" style={{ fontSize: 13, fontWeight: 600 }}>{sessionTitle(s)}</div>
        <div className="clip" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
          {s.model || "–"}
          {ctx != null && <span style={{ color: ctx > 100 ? "var(--warn)" : undefined }}> · context {ctx > 100 ? "over full" : `${ctx}% full`}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{tokens ? `${fmtTokens(tokens)} tokens` : "–"}</div>
        <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{relTime(s.updatedAt)}</div>
      </div>
    </button>
  );
}

function AgentDetail({ agent, onClose, onChat }: { agent: Agent; onClose: () => void; onChat: () => void }) {
  const tabs = ["overview", "sessions", "crons"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
  const recentSessions = (agent.sessions || []).slice(0, 10);
  const cronAction = useCronAction();
  const [ask, setAsk] = useState<{ job: CronJob; kind: "run" | "model" } | null>(null);
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
                ["Status", <span style={{ color: agent.status === "running" ? "var(--ok)" : "var(--text-dim)" }}>{agent.task || "Idle"}</span>],
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
            {recentSessions.length ? recentSessions.map(s => <SessionRow key={s.sessionId || s.key} s={s} onOpen={onChat} />) : <div style={{ padding: 20, color: "var(--text-ghost)", textAlign: "center", fontSize: 13 }}>No sessions</div>}
          </div>
        )}
        {tab === "crons" && (
          <div className="card" style={{ padding: "0 14px" }}>
            {(agent.crons || []).length ? (agent.crons || []).map(c => (
              <CronJobRow key={c.id} job={c} agentModel={agent.model} action={cronAction}
                onAskRun={() => setAsk({ job: c, kind: "run" })} onAskModel={() => setAsk({ job: c, kind: "model" })} />
            )) : <div style={{ padding: 20, color: "var(--text-ghost)", textAlign: "center", fontSize: 13 }}>No cron jobs</div>}
          </div>
        )}
      </div>
      <CronSheets ask={ask} agentModel={agent.model} action={cronAction} onClose={() => setAsk(null)} />
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
  const loading = !d.ready.agents;


  return (
    <div className="screen pad-b anim-screen">
      <Header title="Agents" sub={loading ? "Loading…" : `${allAgents.length} deployed`} right={<ConnectionBadge />} />
      <OfflineBanner pageName="Agents" />
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, padding: "0 18px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
        {[
          { label: "Agents", value: loading ? "–" : allAgents.length, tone: "var(--accent)" },
          { label: "Sessions", value: d.ready.sessions ? d.sessions.length : "–", tone: "var(--purple)" },
          { label: "Cron Jobs", value: d.ready.cron ? d.crons.length : "–", tone: "var(--cyan)" },
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
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-ghost)", fontSize: 14, gridColumn: "1 / -1" }}>
            {loading ? "Loading agents…" : allAgents.length ? `No ${filter.toLowerCase()} agents` : "No agents yet"}
          </div>
        )}
      </div>
    </div>
  );
}
