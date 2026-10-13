"use client";

import { useEffect } from "react";
import { Icon, TopBar } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { markSeen, useNotifications } from "@/lib/notifications";

const COLOR = { err: "var(--err)", warn: "var(--warn)", info: "var(--accent)" } as const;

export function Notifications({ nav }: ScreenProps) {
  const { items, unseen, isSeen, loading, error } = useNotifications();

  // Opening the list counts as seeing everything in it (they stay listed, without the badge)
  const unseenKey = unseen.map(n => n.id).join("|");
  useEffect(() => {
    if (unseenKey) markSeen(unseenKey.split("|"));
  }, [unseenKey]);

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Notifications" sub={items.length ? `${items.length} need${items.length === 1 ? "s" : ""} attention` : "Nothing needs you"} />
      <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {error && !items.length && <div className="card" style={{ padding: 13, color: "var(--err)", fontSize: 13 }}>{error.message}</div>}
        {loading && !items.length && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Checking…</div>}
        {!loading && !error && !items.length && (
          <div className="card" style={{ padding: "34px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--ok-soft)", color: "var(--ok)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={22} stroke={2.2} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>All clear</div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5, maxWidth: 300 }}>
              You&apos;ll see device requests, failed tasks or jobs, connection problems and agent replies here.
            </div>
          </div>
        )}
        {items.map(n => {
          const c = COLOR[n.severity];
          const fresh = !isSeen(n.id);
          return (
            <button key={n.id} className="tap card" onClick={() => nav.openPath(n.link)}
              style={{ padding: 14, display: "flex", gap: 12, textAlign: "left", width: "100%", position: "relative" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in oklab, ${c} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: c, flexShrink: 0 }}>
                <Icon name={n.icon} size={19} stroke={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="between" style={{ gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 640 }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-ghost)", flexShrink: 0 }}>{relTime(n.at)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>{n.text}</div>
              </div>
              {fresh && <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: 4, background: "var(--accent)" }} />}
            </button>
          );
        })}
        {items.length > 0 && (
          <div style={{ fontSize: 11.5, color: "var(--text-ghost)", textAlign: "center", marginTop: 6 }}>
            Tap an item to act on it. Items clear on their own once the problem is resolved.
          </div>
        )}
      </div>
    </div>
  );
}
