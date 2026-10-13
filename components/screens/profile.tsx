"use client";

import type { ReactNode } from "react";
import { Avatar, Icon, Pill, Row, Section, TopBar } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData, useWhoami } from "@/lib/queries";

function InfoRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
      {rows.map(([k, v], i) => (
        <div key={k} className="between" style={{ padding: "13px 0", gap: 12, borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span style={{ fontSize: 13.5, color: "var(--text-dim)", flexShrink: 0 }}>{k}</span>
          <span className="clip" style={{ fontSize: 13.5, fontWeight: 580, textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Profile({ nav }: ScreenProps) {
  const { data: me, error } = useWhoami();
  const { status } = useData();
  const device = me?.device;

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Profile" sub="Who is using Jarvis right now" />
      <div className="pad">
        {error && <div className="card" style={{ padding: 13, marginBottom: 14, color: "var(--err)", fontSize: 13 }}>{error.message}</div>}
        {!me && !error && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Loading…</div>}
        {me && <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 20px" }}>
            <Avatar name={me.mac.fullName} color="slate" size={84} />
            <div style={{ fontSize: 20, fontWeight: 740, marginTop: 14, letterSpacing: -0.4 }}>{me.mac.fullName}</div>
            <div style={{ fontSize: 13.5, color: "var(--text-faint)", marginTop: 3 }}>{me.email || `${me.mac.username}@${me.mac.hostname}`}</div>
            <Pill tone={me.remote ? "purple" : "ok"} style={{ marginTop: 10 }}>
              <Icon name={me.remote ? "globe" : "monitor"} size={11} stroke={2.4} />
              {me.remote ? "Remote · via Cloudflare" : "On this Mac"}
            </Pill>
          </div>

          <Section title="This session" />
          <InfoRows rows={me.remote ? [
            ["Signed in as", me.email || "–"],
            ["Device", device?.name || "–"],
            ["Approved", device?.approvedAt ? relTime(device.approvedAt) : "–"],
            ["IP address", device?.ip || "–"],
          ] : [
            ["Access", "Local (no approval needed)"],
            ["Mac user", me.mac.username],
            ["Computer", me.mac.hostname],
          ]} />

          <Section title="Versions" />
          <InfoRows rows={[
            ["Jarvis", me.appVersion],
            ["OpenClaw", status?.runtimeVersion || "…"],
            ["Node.js", me.nodeVersion],
          ]} />

          <div className="card" style={{ padding: "2px 14px" }}>
            <Row icon="lock" iconColor="var(--ok)" title="Manage devices" sub="Approve or revoke remote access" chev last onClick={() => nav.push("devices")} />
          </div>
        </>}
      </div>
    </div>
  );
}
