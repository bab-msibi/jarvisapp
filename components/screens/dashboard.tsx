"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UploadSheet } from "@/components/screens/files";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Btn, Dot, GhostBtn, Header, Icon, MiniBars, Ring, Section, Sheet, type IconName, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { Nav, ScreenProps } from "@/lib/nav";
import { useNotifications } from "@/lib/notifications";
import { loadPortfolio, valuePortfolio, type Portfolio } from "@/lib/paper-portfolio";
import { contextPct, fmtTokens, sessionTitle, sessionTokens } from "@/lib/sessions";
import { useData, useDigest, useGateway, useMarket, useModelConfig, useTunnel } from "@/lib/queries";
import type { CronJob, SystemStats } from "@/lib/types";

const TONE_COLOR: Record<string, string> = { info: "var(--accent)", ok: "var(--ok)", purple: "var(--purple)", cyan: "var(--cyan)", warn: "var(--warn)", err: "var(--err)", neutral: "var(--text-faint)" };

// Amber from 75%, red from 90%
const levelColor = (v: number | null | undefined, base: string) => (v == null ? base : v >= 90 ? "var(--err)" : v >= 75 ? "var(--warn)" : base);

function untilTime(ms?: number) {
  if (!ms) return "–";
  const s = Math.max(Math.floor((ms - Date.now()) / 1000), 0);
  if (s < 60) return "now";
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `in ${Math.floor(s / 86400)}d`;
}


export function StatTile({ icon, label, value, tone = "info", spark, sub }: {
  icon: IconName; label: string; value: number | string; tone?: Tone; spark?: number[]; sub?: string;
}) {
  const tmap = TONE_COLOR;
  return (
    <div className="card" style={{ padding: 14, flex: 1, minWidth: 0 }}>
      <div className="between">
        <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: tmap[tone] }}><Icon name={icon} size={16} stroke={2} /></div>
        {spark && <MiniBars data={spark} color={tmap[tone]} w={44} h={20} />}
      </div>
      <div style={{ fontSize: 25, fontWeight: 760, letterSpacing: -0.8, marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 540, marginTop: 4 }}>{label}</div>
      {sub && <div className="clip" style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MetricRing({ icon, label, value, color }: { icon: IconName; label: string; value: number | null; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1 }}>
      <Ring value={value ?? 0} size={58} stroke={5} color={levelColor(value, color)} label={value == null ? "–" : `${value}%`} />
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-faint)" }}>
        <Icon name={icon} size={13} stroke={2} /><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  );
}

// CPU / RAM / GPU over the last 30 minutes, on a fixed 0–100% scale
function HistoryChart({ history }: { history: SystemStats["history"] }) {
  if (history.length < 2) {
    return <div style={{ fontSize: 11.5, color: "var(--text-ghost)", padding: "10px 0 2px" }}>Collecting history… (a point every 30s)</div>;
  }
  const W = 300, H = 56;
  const t0 = history[0].t, span = history.at(-1)!.t - t0 || 1;
  const line = (pick: (s: SystemStats["history"][number]) => number | null) =>
    history.map(s => [((s.t - t0) / span) * W, H - ((pick(s) ?? 0) / 100) * H].map(n => n.toFixed(1)).join(",")).join(" ");
  const series = [
    { key: "CPU", color: "var(--accent)", pts: line(s => s.cpu), last: history.at(-1)!.cpu },
    { key: "RAM", color: "var(--purple)", pts: line(s => s.ram), last: history.at(-1)!.ram },
    ...(history.some(s => s.gpu != null) ? [{ key: "GPU", color: "var(--cyan)", pts: line(s => s.gpu), last: history.at(-1)!.gpu }] : []),
  ];
  const mins = Math.round(span / 60000);
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {series.map(s => (
            <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-faint)", fontWeight: 560 }}>
              <Dot color={s.color} size={6} />{s.key} <span className="mono">{s.last ?? "–"}%</span>
            </span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-ghost)" }}>last {mins}m</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 56 }} aria-label="CPU, RAM and GPU history">
        {[25, 50, 75].map(y => <line key={y} x1={0} x2={W} y1={H - (y / 100) * H} y2={H - (y / 100) * H} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {series.map(s => <polyline key={s.key} points={s.pts} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
    </div>
  );
}

function StatusPill({ ok, warn, label, onClick }: { ok: boolean | null; warn?: boolean; label: string; onClick: () => void }) {
  const color = ok == null ? "var(--text-ghost)" : !ok ? "var(--err)" : warn ? "var(--warn)" : "var(--ok)";
  return (
    <button className="tap" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 100, flexShrink: 0,
      background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>
      <Dot color={color} size={7} />{label}
    </button>
  );
}

function StatusStrip({ nav }: { nav: Nav }) {
  const { data: gw, isError: gwErr } = useGateway();
  const { data: mc } = useModelConfig();
  const { data: tunnel } = useTunnel();
  const discord = gw?.channels?.find(c => c.name === "discord");
  const model = mc?.defaultModel?.split("/").pop();
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 14px", scrollbarWidth: "none" }}>
      <StatusPill ok={gwErr ? false : gw ? gw.ok : null} warn={gw?.degraded}
        label={gwErr ? "Gateway down" : gw ? `Gateway ${gw.degraded ? "degraded" : "OK"} · ${gw.latencyMs}ms` : "Gateway…"} onClick={() => nav.push("openclaw")} />
      {discord && <StatusPill ok={discord.connected} label={`Discord ${discord.connected ? "connected" : "offline"}`} onClick={() => nav.push("openclaw")} />}
      <StatusPill ok={mc ? !!model : null} label={model ? `Model ${model}` : "Model…"} onClick={() => nav.push("defaultModel")} />
      {tunnel?.configured && (
        <StatusPill ok={tunnel.running && tunnel.reachable} warn={!tunnel.accessProtected}
          label={tunnel.running && tunnel.reachable ? "Remote access on" : "Remote access down"} onClick={() => nav.go("settings")} />
      )}
    </div>
  );
}

function UpNext({ crons, nav }: { crons: CronJob[]; nav: Nav }) {
  const upcoming = crons.filter(c => c.enabled !== false && c.state?.nextRunAtMs).sort((a, b) => a.state!.nextRunAtMs! - b.state!.nextRunAtMs!).slice(0, 4);
  if (!upcoming.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <Section title="Up Next" />
      <div className="card" style={{ padding: "4px 14px" }}>
        {upcoming.map((c, i) => {
          const st = c.state!;
          const failed = (st.consecutiveErrors ?? 0) > 0 || (st.lastRunStatus && st.lastRunStatus !== "ok");
          const at = new Date(st.nextRunAtMs!).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false });
          return (
            <button key={c.id || c.name} className="tap" onClick={() => c.agentId && nav.push("agentDetail", { id: c.agentId })}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", width: "100%", minWidth: 0, textAlign: "left",
                borderBottom: i < upcoming.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--purple)" }}>
                <Icon name="clock" size={15} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="clip" style={{ fontSize: 13, fontWeight: 640 }}>{c.name}</div>
                <div className="clip" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>
                  {st.lastRunAtMs
                    ? <><span style={{ color: failed ? "var(--err)" : "var(--ok)", fontWeight: 600 }}>{failed ? `✕ failed${(st.consecutiveErrors ?? 0) > 1 ? ` ×${st.consecutiveErrors}` : ""}` : "✓ ok"}</span> · last run {relTime(st.lastRunAtMs)}</>
                    : "Never run"}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 620, color: "var(--text-dim)" }}>{untilTime(st.nextRunAtMs)}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>{at}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Just enough markdown for the digest: headings, bullets, quotes, **bold**, _italic_
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} style={{ color: "var(--text)" }}>{part.slice(2, -2)}</strong>
    : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
    : part);
}

function DigestMarkdown({ md }: { md: string }) {
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-dim)" }}>
      {md.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return null;
        if (line.startsWith("### ")) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "12px 0 4px" }}>{inline(line.slice(4))}</div>;
        if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", margin: "16px 0 6px" }}>{line.slice(3).toUpperCase()}</div>;
        if (line.startsWith("> ")) return <div key={i} style={{ borderLeft: "3px solid var(--accent)", padding: "2px 0 2px 10px", margin: "8px 0", color: "var(--text)" }}>{inline(line.slice(2))}</div>;
        if (line.startsWith("- ")) return <div key={i} style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--text-ghost)" }}>•</span><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{inline(line.slice(2))}</span></div>;
        return line.trim() ? <div key={i}>{inline(line)}</div> : null;
      })}
    </div>
  );
}

function DigestCard() {
  const { data, regenerate } = useDigest();
  const [open, setOpen] = useState(false);
  const d = data?.digest;
  const running = !!data?.run && !data.run.finishedAt;
  const failed = data?.run?.finishedAt && data.run.ok === false;
  const today = d && new Date(d.generatedAt).toDateString() === new Date().toDateString();
  const body = running ? "Writing a fresh digest… (about a minute)"
    : d?.broken ? "The last digest ran while Jarvis was offline, so it has no data."
    : d?.summary || (d ? "No summary in this digest." : "No digest yet. The first one is written at 08:00.");
  return (
    <div style={{ marginBottom: 16 }}>
      <Section title="Daily Digest" action={d ? "Read" : undefined} onAction={() => setOpen(true)} />
      <div className="card tap" onClick={() => d && setOpen(true)} style={{ padding: 14, cursor: d ? "pointer" : "default" }}>
        <div className="between" style={{ marginBottom: 6, gap: 10 }}>
          <span className="clip" style={{ fontSize: 12, fontWeight: 650, color: "var(--text-faint)" }}>{d ? (today ? "Today" : d.title) : "—"}</span>
          {d && <span style={{ fontSize: 11.5, color: "var(--text-ghost)", flexShrink: 0 }}>{relTime(d.generatedAt)}</span>}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: !running && (d?.broken || failed) ? "var(--warn)" : "var(--text-dim)" }}>
          {failed ? "The last regeneration failed; see scripts/daily-digest.log." : body}
        </div>
        {(!today || d?.broken || failed) && !running && (
          <div style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
            <Btn size="sm" variant="glass" icon="refresh" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>Generate now</Btn>
          </div>
        )}
      </div>
      <Sheet open={open && !!d} onClose={() => setOpen(false)} title={d?.title}>
        {d && <DigestMarkdown md={d.markdown} />}
      </Sheet>
    </div>
  );
}

// Paper portfolio from this browser's Trade tab, valued at the (simulated) market prices
function PaperTile({ nav }: { nav: Nav }) {
  const { data: market } = useMarket();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  useEffect(() => { setPortfolio(loadPortfolio()); }, []);
  if (!portfolio) return null;
  const { netWorth, totalReturn, positions } = valuePortfolio(portfolio, market);
  const up = totalReturn >= 0;
  const color = !market ? "var(--text-faint)" : up ? "var(--ok)" : "var(--err)";
  return (
    <div className="pad" style={{ marginBottom: 16 }}>
      <button className="tap card" onClick={() => nav.go("trading")} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, width: "100%", textAlign: "left" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in oklab, ${color} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
          <Icon name="chart" size={18} stroke={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 650 }}>Paper portfolio</div>
          <div className="clip" style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 1 }}>
            {positions.length ? `${positions.length} position${positions.length === 1 ? "" : "s"}` : "No open positions"} · simulated prices
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>${netWorth.toLocaleString("en", { maximumFractionDigits: 0 })}</div>
          <div className="mono" style={{ fontSize: 11.5, fontWeight: 650, color }}>{market ? `${up ? "+" : ""}${totalReturn.toFixed(2)}%` : "–"}</div>
        </div>
      </button>
    </div>
  );
}


export function Dashboard({ nav }: ScreenProps) {
  const d = useData();
  const { sys, agents, tasks, models, sessions, crons, ready } = d;
  const { unseen } = useNotifications();
  const [uploading, setUploading] = useState(false);

  const runningAgents = agents.filter(a => a.status === "running").length;
  const defaultAgent = agents.find(a => a.isDefault) || agents[0];
  const runningTasks = tasks.filter(t => t.status === "running").length;
  const failedTasks = tasks.filter(t => t.status === "failed").length;
  const activeModels = models.filter(m => m.status === "active" || m.status === "loaded").length;
  const defaultModel = models.find(m => m.status === "active")?.name;

  // Timeline: tasks plus cron runs, newest first
  type Item = { id: string; label: string; text: string; ts?: number; tone: Tone; icon: IconName; meta: string };
  const activityItems: Item[] = [
    ...tasks.map((t): Item => ({
      id: `t:${t.id}`, label: t.agent || "Agent", text: t.title, ts: t.ts,
      tone: t.status === "succeeded" ? "ok" : t.status === "running" ? "info" : t.status === "failed" ? "err" : "neutral",
      icon: t.status === "succeeded" ? "check" : t.status === "running" ? "play" : t.status === "failed" ? "warn" : "clock",
      meta: t.error || "",
    })),
    // Cron runs are usually logged as tasks too; only add the ones that aren't
    ...crons.filter(c => c.state?.lastRunAtMs && !tasks.some(t => t.title === c.name)).map((c): Item => {
      const ok = c.state!.lastRunStatus === "ok";
      return { id: `c:${c.id || c.name}`, label: `${c.agentId || "Agent"} · cron`, text: c.name, ts: c.state!.lastRunAtMs,
        tone: ok ? "ok" : "err", icon: ok ? "check" : "warn", meta: ok ? "" : `Last run ${c.state!.lastRunStatus || "failed"}` };
    }),
  ].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 6);

  const quicks: { icon: IconName; label: string; tone: Tone; go: () => void }[] = [
    { icon: "message", label: "Chat", tone: "info", go: () => (defaultAgent ? nav.push("agentChat", { id: defaultAgent.id }) : nav.go("agents")) },
    { icon: "columns", label: "New Task", tone: "purple", go: () => nav.push("createTask") },
    { icon: "upload", label: "Upload File", tone: "cyan", go: () => setUploading(true) },
    { icon: "play", label: "Launch Agent", tone: "ok", go: () => nav.go("agents") },
    { icon: "monitor", label: "Mac Control", tone: "warn", go: () => nav.go("mac") },
  ];

  const macOnline = !!sys;
  const macStatus = sys ? `Online · up ${sys.uptime} · ${sys.ip}` : "Connecting…";
  const lowBattery = sys?.battPct != null && sys.battPct <= 20;
  const recentSessions = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 4);

  return (
    <div className="screen pad-b anim-screen">
      <Header
        sub={new Date().toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
        title="Command"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ConnectionBadge />
            <GhostBtn icon="bell" badge={unseen.length > 0} onClick={() => nav.push("notifications")} />
          </div>
        }
      />
      <OfflineBanner pageName="Dashboard" />
      <StatusStrip nav={nav} />

      <div className="dash-grid">
      <div className="dash-col">
      {/* Mac card — real data */}
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", flexShrink: 0 }}>
                <Icon name="monitor" size={22} stroke={1.8} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 680, letterSpacing: -0.3 }}>{sys?.model || "Mac"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Dot pulse={macOnline} color={macOnline ? "var(--ok)" : "var(--text-ghost)"} />
                  <span className="clip" style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 540 }}>{macStatus}</span>
                </div>
              </div>
            </div>
            <button className="tap" onClick={() => nav.go("mac")} style={{ color: "var(--text-ghost)" }}>
              <Icon name="chevR" size={20} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <MetricRing icon="cpu" label="CPU" value={sys ? sys.cpuPct : null} color="var(--accent)" />
            <MetricRing icon="ram" label="RAM" value={sys ? sys.ramPct : null} color="var(--purple)" />
            <MetricRing icon="gpu" label="GPU" value={sys?.gpuPct ?? null} color="var(--cyan)" />
            <MetricRing icon="disk" label="Disk" value={sys ? sys.diskPct : null} color="var(--ok)" />
          </div>
          {sys && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              {sys.battPct !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: lowBattery ? 650 : 400,
                  color: lowBattery ? (sys.charging ? "var(--warn)" : "var(--err)") : "var(--text-faint)" }}>
                  <Icon name="battery" size={13} stroke={2} />
                  <span>{sys.battPct}%{sys.charging ? " · Charging" : lowBattery ? " · Low battery" : ""}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}>
                <Icon name="cpu" size={13} stroke={2} />
                <span className="mono">{sys.load1} load</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: sys.ramPct >= 75 ? levelColor(sys.ramPct, "") : "var(--text-faint)" }}>
                <Icon name="ram" size={13} stroke={2} />
                <span>{sys.ramUsedGb} / {sys.ramTotalGb} GB</span>
              </div>
            </div>
          )}
          {sys && <HistoryChart history={sys.history ?? []} />}
        </div>
      </div>

      {/* Quick actions */}
      <div className="quick-row" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 18px 16px", scrollbarWidth: "none" }}>
        {quicks.map((q, i) => {
          const c = TONE_COLOR[q.tone];
          return (
            <button key={i} className="tap card" onClick={q.go} style={{ flexShrink: 0, width: 84, padding: "13px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `color-mix(in oklab, ${c} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: c }}>
                <Icon name={q.icon} size={19} stroke={2} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 580, color: "var(--text-dim)", textAlign: "center", lineHeight: 1.2 }}>{q.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stat tiles — real counts; "–" until each source has answered */}
      <div className="pad" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <StatTile icon="robot" label="Agents" value={ready.agents ? agents.length : "–"} tone="info"
          sub={ready.agents ? `${runningAgents} running` : undefined} />
        <StatTile icon="columns" label="Active tasks" value={ready.tasks ? runningTasks : "–"} tone="purple"
          sub={ready.tasks ? (failedTasks ? `${failedTasks} failed · ${tasks.length} total` : `${tasks.length} total`) : undefined} />
        <StatTile icon="brain" label="Models" value={ready.models ? activeModels : "–"} tone="cyan"
          sub={ready.models && defaultModel ? `default ${defaultModel}` : undefined} />
      </div>
      <PaperTile nav={nav} />
      </div>{/* end left column */}

      <div className="dash-col">
      <div className="pad">
        <DigestCard />
        <UpNext crons={crons} nav={nav} />

        {/* Activity feed — tasks and cron runs */}
        <Section title="Recent Activity" action="All tasks" onAction={() => nav.go("tasks")} />
        <div className="card" style={{ padding: "4px 14px" }}>
          {activityItems.length > 0 ? activityItems.map((a, i) => {
            const tone = TONE_COLOR[a.tone] || "var(--text-faint)";
            return (
              <div key={a.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < activityItems.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `color-mix(in oklab, ${tone} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: tone, flexShrink: 0, marginTop: 2 }}>
                  <Icon name={a.icon} size={15} stroke={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between" style={{ gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 640, letterSpacing: -0.1 }}>{a.label}</span>
                    <span style={{ fontSize: 11.5, color: "var(--text-ghost)", fontWeight: 540, flexShrink: 0 }}>{relTime(a.ts)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.35, overflowWrap: "anywhere" }}>{a.text}</div>
                  {a.meta && <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3, display: "inline-block" }}>{a.meta}</span>}
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>
              {d.connected === false ? "Connect to server to see activity" : !ready.tasks ? "Loading…" : "No recent activity"}
            </div>
          )}
        </div>

        {/* Sessions — tap to open that agent's chat */}
        {recentSessions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Section title="Recent Sessions" />
            <div className="card" style={{ padding: "4px 14px" }}>
              {recentSessions.map((s, i) => {
                const total = sessionTokens(s);
                const ctxPct = contextPct(s);
                return (
                  <button key={s.sessionId || s.key} className="tap" onClick={() => s.agentId && nav.push("agentChat", { id: s.agentId })}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", width: "100%", minWidth: 0, textAlign: "left",
                      borderBottom: i < recentSessions.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="message" size={14} stroke={2} style={{ color: "var(--accent)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="clip" style={{ fontSize: 13, fontWeight: 600 }}>{sessionTitle(s)}</div>
                      <div className="clip" style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>
                        {s.agentId || "agent"}{s.model ? ` · ${s.model}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }} title={ctxPct != null ? `${ctxPct}% of context window` : undefined}>
                        {total ? `${fmtTokens(total)} tokens` : "–"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>{relTime(s.updatedAt)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>{/* end right column */}
      </div>{/* end dash-grid */}
      <UploadSheet open={uploading} onClose={() => setUploading(false)} />
    </div>
  );
}
