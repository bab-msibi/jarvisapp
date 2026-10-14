"use client";

import { useState } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Bar, Btn, Dot, GhostBtn, Header, Icon, Pill, Row, Section, Sheet, type IconName, type Tone } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";
import { useGateway, useSystem } from "@/lib/queries";

interface Control { icon: IconName; label: string; tone: Tone; kill?: boolean }

const CONTROL_COLOR: Partial<Record<Tone, string>> = { err: "var(--err)", warn: "var(--warn)", info: "var(--accent)", ok: "var(--ok)", purple: "var(--purple)", cyan: "var(--cyan)" };

function MacMetricRow({ icon, label, pct, color, sub }: { icon: IconName; label: string; pct: number; color: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="between" style={{ marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
          <Icon name={icon} size={15} stroke={2} />
          <span style={{ fontSize: 13, fontWeight: 580 }}>{label}</span>
        </div>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{sub}</span>
      </div>
      <Bar value={pct} color={color} h={7} />
    </div>
  );
}

export function Mac({ nav }: ScreenProps) {
  const { data: sys, isPending: loading, refetch } = useSystem();
  const { data: gw, isError: gwDown } = useGateway();
  const gatewaySub = gwDown ? "Gateway not responding" : !gw ? "Checking…" : gw.ok ? `Gateway ${gw.degraded ? "degraded" : "OK"} · ${gw.latencyMs}ms` : "Gateway reports a problem";
  const refresh = () => { void refetch(); };
  const [sheet, setSheet] = useState<Control | null>(null);

  const controls: Control[] = [
    { icon: "power", label: "Shutdown", tone: "err" }, { icon: "refresh", label: "Restart", tone: "warn" },
    { icon: "moon", label: "Sleep", tone: "info" }, { icon: "bolt", label: "Wake", tone: "ok" },
    { icon: "lock", label: "Lock Screen", tone: "purple" }, { icon: "terminal", label: "Run Command", tone: "cyan" },
  ];

  const cpuSub = sys ? `${sys.cpuCores}-core · ${sys.cpuUser.toFixed(0)}% user / ${sys.cpuSys.toFixed(0)}% sys` : "–";
  const ramSub = sys ? `${sys.ramUsedGb} / ${sys.ramTotalGb} GB` : "–";
  const diskSub = sys ? `${sys.diskUsedGb} / ${sys.diskTotalGb} GB` : "–";
  const gpuSub = sys?.gpus?.length ? sys.gpus[sys.gpus.length - 1] : "–";

  const info: [string, string][] = sys ? [
    ["Device", sys.model],
    ["Chip / CPU", sys.cpuModel.replace(/\(R\)/g,"").replace(/\(TM\)/g,"")],
    ["macOS", `macOS ${sys.osVersion}`],
    ["Uptime", sys.uptime],
    ["IP Address", sys.ip],
    ["Battery", sys.battStatus],
    ["Network In", `${sys.netInMb} MB received`],
    ["Network Out", `${sys.netOutMb} MB sent`],
    ["Load (1m)", sys.load1],
  ] : [
    ["Device", "–"], ["macOS", "–"], ["Uptime", "–"],
    ["IP Address", "–"], ["Battery", "–"],
  ];

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Mac Control" sub="Live system data" right={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ConnectionBadge />
          <GhostBtn icon="refresh" onClick={refresh} />
        </div>
      } />
      <OfflineBanner pageName="Mac" />
      <div className="pad">
        {/* Status card */}
        <div className="card" style={{ padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "var(--ok-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ok)" }}>
            <Icon name="monitor" size={24} stroke={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{sys?.model || "Mac"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              {loading ? <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--surface-2)", borderTopColor: "var(--accent)", animation: "spin .7s linear infinite", display: "inline-block" }} /> : <Dot pulse />}
              <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                {sys ? `Online · up ${sys.uptime} · ${sys.ip}` : "Loading…"}
              </span>
            </div>
          </div>
          <Pill tone="ok"><Icon name="shield" size={12} stroke={2.2} />Live</Pill>
        </div>

        {/* Resource meters */}
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <MacMetricRow icon="cpu" label="CPU" pct={sys?.cpuPct ?? 0} color="var(--accent)" sub={cpuSub} />
          <MacMetricRow icon="ram" label="Memory" pct={sys?.ramPct ?? 0} color="var(--purple)" sub={ramSub} />
          <div style={{ marginBottom: 14 }}>
            <div className="between" style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
                <Icon name="gpu" size={15} stroke={2} /><span style={{ fontSize: 13, fontWeight: 580 }}>GPU</span>
              </div>
              <span className="mono clip" style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 180 }}>{gpuSub}</span>
            </div>
            <div style={{ height: 7, borderRadius: 7, background: "var(--surface-2)" }} />
          </div>
          <div style={{ marginBottom: 0 }}>
            <div className="between" style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
                <Icon name="disk" size={15} stroke={2} /><span style={{ fontSize: 13, fontWeight: 580 }}>Disk</span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{diskSub}</span>
            </div>
            <Bar value={sys?.diskPct ?? 0} color="var(--ok)" h={7} />
          </div>
        </div>

        {/* Battery strip if on battery */}
        {sys && sys.battPct !== null && (
          <div className="card" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="battery" size={20} style={{ color: sys.charging ? "var(--ok)" : sys.battPct < 20 ? "var(--err)" : "var(--text-dim)" }} stroke={1.8} />
            <div style={{ flex: 1 }}>
              <Bar value={sys.battPct} color={sys.charging ? "var(--ok)" : sys.battPct < 20 ? "var(--err)" : "var(--accent)"} h={6} />
            </div>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 640, color: sys.charging ? "var(--ok)" : "var(--text-dim)", flexShrink: 0 }}>{sys.battStatus}</span>
          </div>
        )}

        {/* Network stats */}
        {sys && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {([["download", "Network In", `${sys.netInMb} MB`, "var(--accent)"], ["upload", "Network Out", `${sys.netOutMb} MB`, "var(--cyan)"]] as [IconName, string, string, string][]).map(([ic, label, val, color]) => (
              <div key={label} className="card" style={{ flex: 1, padding: 14 }}>
                <Icon name={ic} size={17} style={{ color }} stroke={2} />
                <div style={{ fontSize: 17, fontWeight: 740, letterSpacing: -0.4, marginTop: 8, color }}>{val}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <Section title="System Information" />
        <div className="card" style={{ padding: "4px 14px", marginBottom: 16 }}>
          {info.map(([k, v], i) => (
            <div key={k} className="between" style={{ padding: "11px 0", borderBottom: i < info.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{k}</span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 540, maxWidth: "55%", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
            </div>
          ))}
        </div>

        <Section title="Controls" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {controls.map(c => {
            const col = CONTROL_COLOR[c.tone];
            return (
              <button key={c.label} className="tap card" onClick={() => c.label === "Run Command" ? nav.push("terminal") : setSheet(c)} style={{ padding: "16px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `color-mix(in oklab, ${col} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: col }}><Icon name={c.icon} size={20} stroke={2} /></div>
                <span style={{ fontSize: 11.5, fontWeight: 580, color: "var(--text-dim)" }}>{c.label}</span>
              </button>
            );
          })}
        </div>
        <div className="card" style={{ padding: "2px 14px", marginBottom: 14 }}>
          <Row icon="terminal" iconColor="var(--cyan)" title="Terminal" sub="Secure shell access" chev onClick={() => nav.push("terminal")} />
          <Row icon="brain" iconColor="var(--purple)" title="Models" sub="Choose the default model" chev onClick={() => nav.push("defaultModel")} />
          <Row icon="flow" iconColor="var(--accent)" title="OpenClaw Integration" sub={gatewaySub} chev last onClick={() => nav.push("openclaw")} />
        </div>
        <button className="tap" onClick={() => setSheet({ label: "Emergency Stop", icon: "power", tone: "err", kill: true })} style={{ width: "100%", padding: 15, borderRadius: 16, background: "var(--err-soft)", color: "var(--err)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontWeight: 660, fontSize: 14.5, border: "1px solid color-mix(in oklab, var(--err) 30%, transparent)" }}>
          <Icon name="power" size={19} stroke={2.2} />Emergency Kill Switch
        </button>
      </div>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.kill ? "Emergency stop?" : `${sheet?.label}?`}>
        <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.5, marginTop: 0 }}>
          {sheet?.kill ? `This immediately halts all agents, models, and workflows on ${sys?.model || "this Mac"}. Use only in an emergency.` : `Confirm you want to ${sheet?.label?.toLowerCase()} ${sys?.model || "this Mac"} remotely.`}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Btn full variant="glass" onClick={() => setSheet(null)}>Cancel</Btn>
          <Btn full variant={sheet?.kill || sheet?.tone === "err" ? "danger" : "primary"} onClick={() => setSheet(null)}>{sheet?.kill ? "Stop everything" : "Confirm"}</Btn>
        </div>
      </Sheet>
    </div>
  );
}
