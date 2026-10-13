"use client";

import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Dot, GhostBtn, Header, Icon, MiniBars, Ring, Section, type IconName, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useNotifications } from "@/lib/notifications";
import { useData } from "@/lib/queries";

const TONE_COLOR: Record<string, string> = { info: "var(--accent)", ok: "var(--ok)", purple: "var(--purple)", cyan: "var(--cyan)", warn: "var(--warn)", err: "var(--err)", neutral: "var(--text-faint)" };

export function StatTile({ icon, label, value, tone = "info", spark }: {
  icon: IconName; label: string; value: number | string; tone?: Tone; spark?: number[];
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
    </div>
  );
}

function MetricRing({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1 }}>
      <Ring value={value} size={58} stroke={5} color={color} label={`${value}%`} />
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-faint)" }}>
        <Icon name={icon} size={13} stroke={2} /><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  );
}

export function Dashboard({ nav }: ScreenProps) {
  const d = useData();
  const { sys, agents, tasks, models, sessions } = d;
  const { unseen } = useNotifications();

  const agentCount = agents.length;
  const runningTasks = tasks.filter(t => t.col === "In Progress").length;
  const activeModels = models.filter(m => m.status === "active" || m.status === "loaded").length;

  // Activity feed from real tasks + recent sessions
  const activityItems = tasks.slice(0, 6).map((t): { id: string; label: string; text: string; time: string; tone: Tone; icon: IconName; meta: string } => ({
    id: t.id,
    label: t.agent || "Agent",
    text: t.title,
    time: t.due,
    tone: t.col === "Completed" ? "ok" : t.col === "In Progress" ? "info" : t.priority === "High" ? "err" : "neutral",
    icon: t.col === "Completed" ? "check" : t.col === "In Progress" ? "play" : t.block ? "warn" : "clock",
    meta: t.block || "",
  }));

  const quicks: { icon: IconName; label: string; tone: Tone; go: () => void }[] = [
    { icon: "plus", label: "Create Agent", tone: "info", go: () => nav.push("createAgent") },
    { icon: "columns", label: "New Task", tone: "purple", go: () => nav.go("tasks") },
    { icon: "upload", label: "Upload File", tone: "cyan", go: () => nav.go("files") },
    { icon: "play", label: "Launch Agent", tone: "ok", go: () => nav.go("agents") },
    { icon: "monitor", label: "Mac Control", tone: "warn", go: () => nav.go("mac") },
  ];

  const macOnline = !!sys;
  const macStatus = sys ? `Online · up ${sys.uptime} · ${sys.ip}` : "Connecting…";

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

      <div className="dash-grid">
      <div className="dash-col">
      {/* Mac card — real data */}
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="between" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}>
                <Icon name="monitor" size={22} stroke={1.8} />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 680, letterSpacing: -0.3 }}>{sys?.model || "Mac"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Dot pulse={macOnline} color={macOnline ? "var(--ok)" : "var(--text-ghost)"} />
                  <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 540 }}>{macStatus}</span>
                </div>
              </div>
            </div>
            <button className="tap" onClick={() => nav.go("mac")} style={{ color: "var(--text-ghost)" }}>
              <Icon name="chevR" size={20} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <MetricRing icon="cpu" label="CPU" value={sys?.cpuPct ?? 0} color="var(--accent)" />
            <MetricRing icon="ram" label="RAM" value={sys?.ramPct ?? 0} color="var(--purple)" />
            <MetricRing icon="gpu" label="GPU" value={0} color="var(--cyan)" />
            <MetricRing icon="disk" label="Disk" value={sys?.diskPct ?? 0} color="var(--ok)" />
          </div>
          {sys && (
            <div style={{ marginTop: 12, display: "flex", gap: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              {sys.battPct !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}>
                  <Icon name="battery" size={13} stroke={2} />
                  <span>{sys.battPct}% {sys.charging ? "· Charging" : ""}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}>
                <Icon name="cpu" size={13} stroke={2} />
                <span className="mono">{sys.load1} load</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-faint)" }}>
                <Icon name="ram" size={13} stroke={2} />
                <span>{sys.ramUsedGb} / {sys.ramTotalGb} GB</span>
              </div>
            </div>
          )}
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

      {/* Stat tiles — real counts */}
      <div className="pad" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <StatTile icon="robot" label="Agents" value={agentCount} tone="info" spark={[1,1,1,1,1,1,agentCount]} />
        <StatTile icon="columns" label="Active tasks" value={runningTasks} tone="purple" spark={[0,0,0,0,0,0,runningTasks]} />
        <StatTile icon="brain" label="Models" value={activeModels} tone="cyan" spark={[0,0,0,0,0,0,activeModels]} />
      </div>
      </div>{/* end left column */}

      <div className="dash-col">
      {/* Activity feed — real tasks */}
      <div className="pad">
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
                    <span style={{ fontSize: 11.5, color: "var(--text-ghost)", fontWeight: 540, flexShrink: 0 }}>{a.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.35 }}>{a.text}</div>
                  {a.meta && <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3, display: "inline-block" }}>{a.meta}</span>}
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>
              {d.connected === false ? "Connect to server to see activity" : d.loading ? "Loading…" : "No recent tasks"}
            </div>
          )}
        </div>

        {/* Sessions summary */}
        {sessions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Section title="Recent Sessions" />
            <div className="card" style={{ padding: "4px 14px" }}>
              {sessions.slice(0, 4).map((s, i) => {
                const kindLabel = ({ direct: "Direct chat", cron: "Cron job", group: "Discord group", "spawn-child": "Sub-agent" } as Record<string, string>)[s.kind ?? ""] || s.kind;
                const tokens = s.totalTokens ? `${Math.round(s.totalTokens / 1000)}K tokens` : "–";
                return (
                  <div key={s.sessionId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < Math.min(sessions.length, 4) - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="message" size={14} stroke={2} style={{ color: "var(--accent)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{kindLabel}</div>
                      <div className="mono clip" style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>{s.sessionId?.slice(0, 20)}…</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{tokens}</div>
                      <div style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>{relTime(s.updatedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>{/* end right column */}
      </div>{/* end dash-grid */}
    </div>
  );
}
