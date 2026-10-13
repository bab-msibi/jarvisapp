"use client";

import { Dot, GhostBtn, Icon, Pill, Row, Section, TopBar } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData, useGateway, useModelConfig } from "@/lib/queries";

export function OpenClaw({ nav }: ScreenProps) {
  const d = useData();
  const gateway = useGateway();
  const { data: modelCfg } = useModelConfig();
  const g = gateway.data;
  const status = d.status;
  const tasks = status?.tasks;
  const online = !!g?.ok;

  const stats: [string | number, string][] = [
    [d.agents.length, "Agents"],
    [status?.sessions?.count ?? d.sessions.length, "Sessions"],
    [d.crons.length, "Cron jobs"],
    [g?.plugins.length ?? "–", "Plugins"],
  ];

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="OpenClaw" sub="Gateway, models & schedules" right={<GhostBtn icon="refresh" size={38} onClick={() => { d.refresh(); void gateway.refetch(); }} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="between">
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: online ? "var(--ok-soft)" : "var(--err-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: online ? "var(--ok)" : "var(--err)" }}><Icon name="flow" size={22} stroke={1.8} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 680 }}>{g ? (online ? (g.degraded ? "Connected · degraded" : "Connected") : "Gateway down") : gateway.error ? "Gateway unreachable" : "Checking…"}</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                  OpenClaw {status?.runtimeVersion ?? "–"}{g?.latencyMs != null ? ` · ${g.latencyMs} ms` : ""}
                </div>
              </div>
            </div>
            <Dot pulse={online} size={9} color={online ? "var(--ok)" : "var(--err)"} />
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            {stats.map(([v, l]) => (
              <div key={l}><div style={{ fontSize: 17, fontWeight: 740, letterSpacing: -0.4 }}>{v}</div><div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>{l}</div></div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          <Row icon="brain" iconColor="var(--purple)" title="Default model" sub={<span className="mono">{modelCfg?.defaultModel ?? status?.sessions?.defaults?.model ?? "–"}</span>} chev last onClick={() => nav.push("defaultModel")} />
        </div>

        {g && g.channels.length > 0 && <>
          <Section title="Channels" />
          <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
            {g.channels.map((c, i) => (
              <Row key={c.name} icon="message" iconColor="var(--accent)" last={i === g.channels.length - 1}
                title={<span style={{ textTransform: "capitalize" }}>{c.name}{c.botName ? ` · ${c.botName}` : ""}</span>}
                sub={c.lastError ? c.lastError : c.lastConnectedAt ? `Connected ${relTime(c.lastConnectedAt)}` : c.enabled ? "Enabled" : "Disabled"}
                right={<Pill tone={c.connected ? "ok" : c.enabled ? "warn" : "neutral"}>{c.connected ? "Online" : c.enabled ? "Offline" : "Off"}</Pill>} />
            ))}
          </div>
        </>}

        {tasks && <>
          <Section title="Tasks" />
          <div className="card" style={{ padding: 14, marginBottom: 18, display: "flex", gap: 18 }}>
            {([[tasks.total, "Total", "var(--text)"], [tasks.active, "Active", "var(--accent)"], [tasks.failures, "Failed", tasks.failures ? "var(--err)" : "var(--text)"],
              [(status?.taskAudit?.warnings ?? 0) + (status?.taskAudit?.errors ?? 0), "Audit issues", (status?.taskAudit?.errors ?? 0) ? "var(--err)" : "var(--text)"]] as [number, string, string][]).map(([v, l, c]) => (
              <div key={l}><div style={{ fontSize: 17, fontWeight: 740, color: c }}>{v}</div><div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>{l}</div></div>
            ))}
          </div>
        </>}

        <Section title="Scheduled jobs" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {status?.heartbeat?.agents?.map(h => (
            <Row key={`hb-${h.agentId}`} icon="pulse" iconColor="var(--ok)" title={`Heartbeat · ${h.agentId}`} sub={h.enabled ? `Every ${h.every}` : "Disabled"}
              right={<Pill tone={h.enabled ? "ok" : "neutral"}>{h.enabled ? "On" : "Off"}</Pill>} last={!d.crons.length} />
          ))}
          {d.crons.map((c, i) => {
            const st = c.state?.lastRunStatus;
            return (
              <Row key={c.id ?? c.name} icon="clock" iconColor="var(--cyan)" title={c.name} last={i === d.crons.length - 1}
                sub={[c.schedule?.expr, c.state?.nextRunAtMs ? `next ${new Date(c.state.nextRunAtMs).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : null].filter(Boolean).join(" · ")}
                right={<Pill tone={st === "ok" ? "ok" : st === "error" ? "err" : "neutral"}>{c.enabled === false ? "off" : st || "pending"}</Pill>} />
            );
          })}
          {!d.crons.length && !status?.heartbeat?.agents?.length && <div style={{ padding: "14px 4px", fontSize: 13, color: "var(--text-faint)" }}>{d.loading ? "Loading…" : "No scheduled jobs"}</div>}
        </div>

        {g && <>
          <Section title={`Plugins (${g.plugins.length})`} />
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.plugins.map(p => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 100, fontSize: 12, fontWeight: 580, background: "rgba(var(--accent-rgb),0.14)", color: "var(--accent)" }}>
                  <Dot size={6} color="var(--accent)" />{p}
                </span>
              ))}
            </div>
            {g.pluginErrors > 0 && <div style={{ fontSize: 12, color: "var(--err)", marginTop: 10 }}>{g.pluginErrors} plugin error{g.pluginErrors === 1 ? "" : "s"} — run <span className="mono">openclaw doctor</span></div>}
          </div>
        </>}
      </div>
    </div>
  );
}
