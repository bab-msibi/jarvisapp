"use client";

import { useData } from "@/lib/queries";
import { Dot, Icon } from "./primitives";

export function ConnectionBadge() {
  const { connected } = useData();
  if (connected === null) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 100,
      background: connected ? "var(--ok-soft)" : "rgba(239,68,68,0.12)", fontSize: 11, fontWeight: 640,
      color: connected ? "var(--ok)" : "var(--err)" }}>
      <Dot size={5} color={connected ? "var(--ok)" : "var(--err)"} pulse={connected} />
      {connected ? "Live" : "Offline"}
    </div>
  );
}

export function OfflineBanner({ pageName }: { pageName: string }) {
  const { connected } = useData();
  if (connected !== false) return null;
  return (
    <div style={{ margin: "0 18px 14px", padding: "12px 14px", borderRadius: 14,
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
      display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Icon name="warn" size={17} stroke={2} style={{ color: "var(--err)", flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 660, color: "var(--err)", marginBottom: 2 }}>Not connected to local server</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.4 }}>
          {pageName} data is unavailable. Make sure Jarvis is running on this Mac (<span className="mono" style={{ fontSize: 11 }}>npm start</span>).
        </div>
      </div>
    </div>
  );
}
