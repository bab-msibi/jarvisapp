"use client";

import { StatTile } from "@/components/screens/dashboard";
import { Bar, GhostBtn, Section, TopBar } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";

const DAY = 24 * 60 * 60 * 1000;
const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n);
const KIND_LABEL: Record<string, string> = { direct: "Direct chat", cron: "Cron job", group: "Discord group", "spawn-child": "Sub-agent" };
const PALETTE = ["var(--accent)", "var(--purple)", "var(--cyan)", "var(--ok)", "var(--warn)"];

function Breakdown({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      {rows.map(([label, v], i) => (
        <div key={label} style={{ marginBottom: i < rows.length - 1 ? 13 : 0 }}>
          <div className="between" style={{ marginBottom: 6 }}>
            <span className="clip" style={{ fontSize: 13, fontWeight: 580 }}>{label}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{fmt(v)}</span>
          </div>
          <Bar value={(v / max) * 100} color={PALETTE[i % PALETTE.length]} h={6} />
        </div>
      ))}
    </div>
  );
}

export function Analytics({ nav }: ScreenProps) {
  const d = useData();
  const sessions = d.sessions;
  const tokensIn = sessions.reduce((s, x) => s + (x.inputTokens ?? 0), 0);
  const tokensOut = sessions.reduce((s, x) => s + (x.outputTokens ?? 0), 0);
  const tokens = (x: (typeof sessions)[number]) => (x.inputTokens ?? 0) + (x.outputTokens ?? 0);

  // Sessions by the day they were last active, oldest → today
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const from = startOfToday - (6 - i) * DAY;
    return sessions.filter(s => s.updatedAt && s.updatedAt >= from && s.updatedAt < from + DAY).length;
  });
  const dayLabels = Array.from({ length: 7 }, (_, i) => new Date(startOfToday - (6 - i) * DAY).toLocaleDateString("en", { weekday: "short" }));

  const group = (key: (s: (typeof sessions)[number]) => string) => {
    const m: Record<string, number> = {};
    sessions.forEach(s => { const k = key(s); m[k] = (m[k] || 0) + tokens(s); });
    return Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  };
  const byKind = group(s => KIND_LABEL[s.kind ?? ""] || s.kind || "Other");
  const byModel = group(s => s.model || "unknown");
  const taskStatus = Object.entries(d.status?.tasks?.byStatus ?? {}).filter(([, v]) => v > 0) as [string, number][];
  const top = [...sessions].sort((a, b) => tokens(b) - tokens(a)).slice(0, 5);

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Analytics" sub="From OpenClaw sessions & tasks" right={<GhostBtn icon="refresh" size={38} onClick={d.refresh} />} />
      <div className="pad">
        {d.loading && !sessions.length && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Loading…</div>}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <StatTile icon="message" label="Sessions" value={sessions.length} tone="info" />
          <StatTile icon="check" label="Tasks run" value={d.status?.tasks?.total ?? d.tasks.length} tone="ok" />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatTile icon="arrowD" label="Tokens in" value={fmt(tokensIn)} tone="purple" />
          <StatTile icon="arrowU" label="Tokens out" value={fmt(tokensOut)} tone="cyan" />
        </div>

        <Section title="Session activity" />
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 10 }}>Sessions by day of last activity · last 7 days</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 84 }}>
            {perDay.map((n, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                {n > 0 && <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{n}</span>}
                <div style={{ width: "100%", maxWidth: 34, height: `${Math.max(4, (n / Math.max(1, ...perDay)) * 56)}px`, borderRadius: 5,
                  background: n ? "var(--accent)" : "var(--surface-2)" }} />
                <span style={{ fontSize: 10, color: i === 6 ? "var(--text-dim)" : "var(--text-ghost)", fontWeight: i === 6 ? 650 : 500 }}>{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {byKind.length > 0 && <><Section title="Tokens by session type" /><Breakdown rows={byKind} /></>}
        {byModel.length > 0 && <><Section title="Tokens by model" /><Breakdown rows={byModel} /></>}
        {taskStatus.length > 0 && <><Section title="Task outcomes" /><Breakdown rows={taskStatus.map(([k, v]) => [k.replace("_", " "), v])} /></>}

        {top.length > 0 && <>
          <Section title="Heaviest sessions" />
          <div className="card" style={{ padding: "4px 14px" }}>
            {top.map((s, i) => (
              <div key={s.sessionId ?? i} className="between" style={{ padding: "11px 0", gap: 12, borderBottom: i < top.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{KIND_LABEL[s.kind ?? ""] || s.kind} · {s.agentId}</div>
                  <div className="mono clip" style={{ fontSize: 11, color: "var(--text-ghost)", marginTop: 1 }}>{s.model} · {relTime(s.updatedAt)}</div>
                </div>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{fmt(tokens(s))}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}
