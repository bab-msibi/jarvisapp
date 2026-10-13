"use client";

import { useState } from "react";
import { Btn, GhostBtn, Pill, Row, Section, Sheet, TopBar } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useDeviceAction, useDevices } from "@/lib/queries";
import type { DeviceView } from "@/lib/types";

export function Devices({ nav }: ScreenProps) {
  const { data, error: loadError, refetch } = useDevices();
  const action = useDeviceAction();
  const [confirm, setConfirm] = useState<DeviceView | null>(null);
  const list = data?.devices;
  const err = action.error?.message ?? loadError?.message;

  const act = (kind: "approve" | "remove", id: string) => action.mutate({ action: kind, id }, { onSettled: () => setConfirm(null) });

  const pending = (list || []).filter(d => d.status === "pending");
  const approved = (list || []).filter(d => d.status === "approved");
  const meta = (d: DeviceView) => [d.email, d.ip, d.status === "approved" ? `seen ${relTime(d.lastSeen)}` : `requested ${relTime(d.createdAt)}`].filter(Boolean).join(" · ");

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Devices" sub="Who can reach Jarvis remotely" right={<GhostBtn icon="refresh" size={38} onClick={() => void refetch()} />} />
      <div className="pad">
        <div className="card" style={{ padding: 14, marginBottom: 18, fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.55 }}>
          Devices opening Jarvis through the Cloudflare tunnel must be approved here first. This Mac always has access.
          Approve only codes that match what you see on your own device.
        </div>
        {err && <div className="card" style={{ padding: 13, marginBottom: 14, color: "var(--err)", fontSize: 13 }}>{err}</div>}
        {!list && !err && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Loading…</div>}

        {pending.length > 0 && <>
          <Section title={`Waiting for approval (${pending.length})`} />
          <div className="card" style={{ padding: "4px 14px", marginBottom: 18 }}>
            {pending.map((d, i) => (
              <div key={d.id} style={{ padding: "12px 0", borderBottom: i === pending.length - 1 ? "none" : "1px solid var(--border)" }}>
                <div className="between" style={{ gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }} className="clip">{d.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 1 }} className="clip">{meta(d)}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, color: "var(--warn)" }}>{d.code}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Btn full size="sm" variant="glass" onClick={() => act("remove", d.id)}>Deny</Btn>
                  <Btn full size="sm" variant="ok" icon="check" onClick={() => act("approve", d.id)}>Approve</Btn>
                </div>
              </div>
            ))}
          </div>
        </>}

        {list && <>
          <Section title={`Approved (${approved.length})`} />
          <div className="card" style={{ padding: "2px 14px" }}>
            {approved.length === 0 && <div style={{ padding: "14px 4px", fontSize: 13, color: "var(--text-faint)" }}>No remote devices yet. Open your Jarvis address on a phone or laptop to request access.</div>}
            {approved.map((d, i) => (
              <Row key={d.id} last={i === approved.length - 1} icon="monitor" iconColor="var(--ok)"
                title={<span>{d.name}{d.current && <Pill tone="info" style={{ marginLeft: 7 }}>This device</Pill>}</span>} sub={meta(d)}
                right={<Btn size="sm" variant="danger" onClick={() => setConfirm(d)}>Revoke</Btn>} />
            ))}
          </div>
        </>}
      </div>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Revoke access?">
        <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0 }}>
          {confirm?.current ? "This is the device you're using — you'll lose access immediately." : `“${confirm?.name}” will need to request approval again.`}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Btn full variant="glass" onClick={() => setConfirm(null)}>Cancel</Btn>
          <Btn full variant="danger" onClick={() => confirm && act("remove", confirm.id)}>Revoke</Btn>
        </div>
      </Sheet>
    </div>
  );
}
