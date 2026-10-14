"use client";

import type { ReactNode } from "react";
import { originText, STATUS_META } from "@/components/screens/tasks";
import { Btn, Icon, Pill, Section, TopBar, type Tone } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import { whenText } from "@/lib/cron-format";
import type { ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";

const STATUS_TONE: Record<string, Tone> = { running: "info", queued: "neutral", failed: "err", succeeded: "ok", cancelled: "neutral" };

function duration(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const at = (ms?: number) => (ms ? `${whenText(ms)} · ${relTime(ms)}` : "–");

export function TaskDetail({ nav }: ScreenProps) {
  const { tasks, crons, ready } = useData();
  const t = tasks.find(x => x.id === nav.params.id);

  if (!t) {
    return (
      <div className="screen" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
        <TopBar onBack={nav.pop} title="Task" />
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-ghost)", fontSize: 14 }}>
          {ready.tasks ? "This task is no longer in OpenClaw's list (finished tasks are cleaned up after a week)." : "Loading…"}
        </div>
      </div>
    );
  }

  const m = STATUS_META[t.status];
  const from = originText(t, crons);
  const end = t.endedAt ?? (t.status === "running" ? Date.now() : undefined);
  const rows: [string, ReactNode][] = [
    ["Agent", t.agent],
    ["Kind", t.kind],
    ["Started by", from ? from.replace(/^from /, "") : "–"],
    ["Created", at(t.createdAt)],
    ["Started", at(t.startedAt)],
    ["Finished", t.endedAt ? at(t.endedAt) : t.status === "running" ? "Still running" : "–"],
    ["Duration", t.startedAt && end ? duration(end - t.startedAt) : "–"],
    ["Delivery", t.deliveryStatus && t.deliveryStatus !== "not_applicable" ? t.deliveryStatus.replace(/[_-]/g, " ") : "–"],
    ["Raw status", <span className="mono">{t.rawStatus}</span>],
    ["Task ID", <span className="mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{t.id}</span>],
  ];
  const resultIsError = t.status === "failed" && t.result === t.error;

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Task" sub={`${t.kind} · ${relTime(t.ts)}`} />
      <div className="pad">
        <Pill tone={STATUS_TONE[t.status]} style={{ marginBottom: 12 }}>
          <Icon name={m.icon} size={11} stroke={2.4} />{m.label}{t.rawStatus === "timed_out" ? " (timed out)" : ""}
        </Pill>
        <h1 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 740, letterSpacing: -0.5, lineHeight: 1.2, overflowWrap: "anywhere" }}>{t.title}</h1>

        {t.prompt && t.prompt !== t.title && (
          <>
            <Section title="Request" />
            <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-dim)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{t.prompt}</div>
          </>
        )}

        {t.error && (
          <>
            <Section title="Error" />
            <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.5, color: "var(--err)", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
              border: "1px solid color-mix(in oklab, var(--err) 35%, transparent)" }}>{t.error}</div>
          </>
        )}
        {t.result && !resultIsError && (
          <>
            <Section title="Result" />
            <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.5, color: "var(--text-dim)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "40vh", overflow: "auto" }}>{t.result}</div>
          </>
        )}

        <Section title="Details" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {rows.map(([k, v], i) => (
            <div key={k} className="between" style={{ padding: "11px 0", gap: 16, borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 13, color: "var(--text-faint)", flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 560, textAlign: "right", minWidth: 0 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {t.origin?.type === "cron"
            ? <Btn full variant="glass" icon="clock" onClick={() => nav.push("agentDetail", { id: t.agent })}>Open cron job</Btn>
            : <Btn full variant="glass" icon="message" onClick={() => nav.push("agentChat", { id: t.agent })}>Chat with {t.agent}</Btn>}
          <Btn full variant="glass" icon="robot" onClick={() => nav.push("agentDetail", { id: t.agent })}>Open agent</Btn>
        </div>
      </div>
    </div>
  );
}
