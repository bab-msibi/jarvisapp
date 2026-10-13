"use client";

import { Fragment } from "react";
import { Btn, Icon, TopBar, type IconName } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";

export function WorkflowBuilder({ nav }: ScreenProps) {
  const nodes: { icon: IconName; label: string; sub: string; tone: string }[] = [
    { icon: "bolt", label: "Trigger", sub: "Schedule · 2:00 AM daily", tone: "amber" },
    { icon: "search", label: "Web Search", sub: "Gather latest market data", tone: "cyan" },
    { icon: "robot", label: "Research Agent", sub: "Qwen2.5-72B", tone: "blue" },
    { icon: "code", label: "Code Execution", sub: "Transform → CSV", tone: "purple" },
    { icon: "shield", label: "Approval", sub: "Wait for human review", tone: "warn" },
    { icon: "bell", label: "Notification", sub: "Push when complete", tone: "info" },
  ];
  const palette: { icon: IconName; label: string }[] = [
    { icon: "bolt", label: "Trigger" }, { icon: "robot", label: "Agent" }, { icon: "brain", label: "Model" },
    { icon: "search", label: "Search" }, { icon: "code", label: "Code" }, { icon: "doc", label: "File" },
    { icon: "globe", label: "API" }, { icon: "bell", label: "Notify" }, { icon: "shield", label: "Approval" },
  ];
  const tc = (t: string) => ({ amber: "var(--warn)", cyan: "var(--cyan)", blue: "var(--accent)", purple: "var(--purple)", warn: "var(--warn)", info: "var(--accent)" } as Record<string, string>)[t];
  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Workflow Builder" sub="Nightly Data Sync" right={<Btn size="sm" icon="play" onClick={nav.pop} style={{ borderRadius: 11 }}>Run</Btn>} />
      <div className="screen" style={{ flex: 1, padding: "10px 18px 16px", backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {nodes.map((n, i) => (
            <Fragment key={i}>
              <div className="card" style={{ padding: 13, width: "100%", maxWidth: 280, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-solid)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in oklab, ${tc(n.tone)} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: tc(n.tone), flexShrink: 0 }}><Icon name={n.icon} size={20} stroke={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 660 }}>{n.label}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }} className="clip">{n.sub}</div></div>
                <Icon name="dots" size={18} style={{ color: "var(--text-ghost)" }} />
              </div>
              {i < nodes.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: 26 }}>
                  <div style={{ width: 2, flex: 1, background: "var(--border-strong)" }} />
                  <Icon name="chevD" size={14} style={{ color: "var(--text-ghost)", marginTop: -4 }} />
                </div>
              )}
            </Fragment>
          ))}
          <div style={{ width: 2, height: 16, background: "var(--border-strong)" }} />
          <button className="tap" style={{ width: 38, height: 38, borderRadius: 12, border: "1.5px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 0 14px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ fontSize: 11, fontWeight: 680, color: "var(--text-faint)", letterSpacing: 0.4, padding: "0 18px 9px" }}>DRAG A BLOCK TO ADD</div>
        <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "0 18px", scrollbarWidth: "none" }}>
          {palette.map(p => (
            <div key={p.label} className="tap card" style={{ flexShrink: 0, padding: "10px 13px", display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name={p.icon} size={16} style={{ color: "var(--accent)" }} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 580 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
