"use client";

import { GhostBtn, Icon, Pill, Ring, Row, Section, TopBar, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useDevices, useGateway, useTunnel } from "@/lib/queries";

interface Check { title: string; detail: string; tone: Tone; label: string }

const PASS: Tone = "ok";

export function Security({ nav }: ScreenProps) {
  const tunnel = useTunnel();
  const devices = useDevices();
  const gateway = useGateway();
  const t = tunnel.data;
  const list = devices.data?.devices ?? [];
  const approved = list.filter(d => d.status === "approved").sort((a, b) => b.lastSeen - a.lastSeen);
  const pending = list.filter(d => d.status === "pending");

  const checks: Check[] = [
    { title: "Local-only server", detail: "Jarvis listens on 127.0.0.1 — nothing on your network can reach it directly", tone: PASS, label: "On" },
    t ? (t.running
      ? { title: "Cloudflare tunnel", detail: `${t.hostname} · ${t.reachable ? "reachable" : "not reachable from the internet"}`, tone: t.reachable ? PASS : "warn", label: t.reachable ? "Running" : "Unreachable" }
      : { title: "Cloudflare tunnel", detail: t.configured ? "Configured but cloudflared isn't running — remote access is off" : "Not set up", tone: "neutral", label: "Off" })
      : { title: "Cloudflare tunnel", detail: "Checking…", tone: "neutral", label: "…" },
    t ? (t.accessProtected
      ? { title: "Cloudflare Access login", detail: "Visitors must sign in with an approved email first", tone: PASS, label: "On" }
      : { title: "Cloudflare Access login", detail: t.running ? "No Access login detected in front of the tunnel" : "Only applies while the tunnel runs", tone: t.running ? "err" : "neutral", label: t.running ? "Missing" : "–" })
      : { title: "Cloudflare Access login", detail: "Checking…", tone: "neutral", label: "…" },
    { title: "Device approval", detail: `${approved.length} approved${pending.length ? ` · ${pending.length} waiting for you` : ""}`, tone: pending.length ? "warn" : PASS, label: pending.length ? "Review" : "On" },
    gateway.data
      ? { title: "OpenClaw gateway", detail: gateway.data.degraded ? `Degraded: ${gateway.data.degradedReasons.join(", ")}` : `Healthy · ${gateway.data.latencyMs ?? "–"} ms`, tone: gateway.data.ok && !gateway.data.degraded ? PASS : "warn", label: gateway.data.ok ? "Healthy" : "Down" }
      : { title: "OpenClaw gateway", detail: gateway.error ? gateway.error.message : "Checking…", tone: gateway.error ? "err" : "neutral", label: gateway.error ? "Down" : "…" },
  ];
  const passing = checks.filter(c => c.tone === PASS).length;
  const score = Math.round((passing / checks.length) * 100);

  const recheck = () => { void tunnel.recheck(); void devices.refetch(); void gateway.refetch(); };

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Security Center" sub="Live checks" right={<GhostBtn icon="refresh" size={38} onClick={recheck} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <Ring value={score} size={74} stroke={7} color={score === 100 ? "var(--ok)" : score >= 60 ? "var(--warn)" : "var(--err)"} label={`${passing}/${checks.length}`} sub="PASSING" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{score === 100 ? "All checks passing" : `${checks.length - passing} item${checks.length - passing === 1 ? "" : "s"} need attention`}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.4 }}>
              {t ? `Last checked ${relTime(t.checkedAt)}` : "Running checks…"}
            </div>
          </div>
        </div>

        <Section title="Checks" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {checks.map((c, i) => (
            <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < checks.length - 1 ? "1px solid var(--border)" : "none" }}>
              <Icon name={c.tone === PASS ? "check" : c.tone === "neutral" ? "clock" : "warn"} size={17} stroke={2.2}
                style={{ color: c.tone === PASS ? "var(--ok)" : c.tone === "neutral" ? "var(--text-faint)" : c.tone === "err" ? "var(--err)" : "var(--warn)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 1, lineHeight: 1.4 }}>{c.detail}</div>
              </div>
              <Pill tone={c.tone}>{c.label}</Pill>
            </div>
          ))}
        </div>

        <Section title="Remote devices" action="Manage" onAction={() => nav.push("devices")} />
        <div className="card" style={{ padding: "2px 14px" }}>
          {pending.length > 0 && (
            <Row icon="warn" iconColor="var(--warn)" title={`${pending.length} device${pending.length === 1 ? "" : "s"} waiting for approval`} sub="Check the codes before approving" chev
              last={!approved.length} onClick={() => nav.push("devices")} />
          )}
          {approved.slice(0, 5).map((d, i) => (
            <Row key={d.id} icon="monitor" iconColor="var(--ok)" title={<span>{d.name}{d.current && <Pill tone="info" style={{ marginLeft: 7 }}>This device</Pill>}</span>}
              sub={[d.email, d.ip, `seen ${relTime(d.lastSeen)}`].filter(Boolean).join(" · ")} last={i === Math.min(approved.length, 5) - 1} />
          ))}
          {!approved.length && !pending.length && (
            <div style={{ padding: "14px 4px", fontSize: 13, color: "var(--text-faint)" }}>{devices.isPending ? "Loading…" : "No remote devices yet."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
