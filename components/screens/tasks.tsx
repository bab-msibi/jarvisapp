"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Dot, Header, Icon, type IconName } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";
import type { CronJob, Task, TaskStatus } from "@/lib/types";

export const STATUS_META: Record<TaskStatus, { label: string; color: string; icon: IconName }> = {
  running: { label: "Running", color: "var(--accent)", icon: "play" },
  queued: { label: "Queued", color: "var(--text-faint)", icon: "clock" },
  failed: { label: "Failed", color: "var(--err)", icon: "warn" },
  succeeded: { label: "Succeeded", color: "var(--ok)", icon: "check" },
  cancelled: { label: "Cancelled", color: "var(--text-ghost)", icon: "x" },
};
const STATUS_ORDER: TaskStatus[] = ["running", "queued", "failed", "succeeded", "cancelled"];
const VIEW_KEY = "jarvis.tasks.view";

// "from Daily SoccerZone socials draft" / "from New Task" / "from Jarvis app chat"
export function originText(t: Task, crons: CronJob[]) {
  const o = t.origin;
  if (!o) return null;
  if (o.type === "cron") return `from ${crons.find(c => c.id === o.jobId)?.name || "a cron job"}`;
  return o.type === "task" ? "from New Task" : o.type === "chat" ? "from Jarvis app chat" : null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="tap" onClick={onClick}
      style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
        background: active ? "var(--accent)" : "var(--surface)", color: active ? "#fff" : "var(--text-dim)",
        border: active ? "none" : "1px solid var(--border)" }}>
      {children}
    </button>
  );
}

function TaskRow({ t, crons, last, onOpen, compact }: { t: Task; crons: CronJob[]; last?: boolean; onOpen: () => void; compact?: boolean }) {
  const m = STATUS_META[t.status];
  const from = originText(t, crons);
  const showPrompt = t.prompt && t.prompt !== t.title;
  return (
    <button className="tap" onClick={onOpen}
      style={{ display: "flex", gap: 12, padding: compact ? "11px 12px" : "12px 0", width: "100%", minWidth: 0, textAlign: "left",
        borderBottom: last || compact ? "none" : "1px solid var(--border)" }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: `color-mix(in oklab, ${m.color} 15%, transparent)`, color: m.color }}>
        <Icon name={m.icon} size={15} stroke={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="between" style={{ gap: 8 }}>
          <span className="clip" style={{ fontSize: 13.5, fontWeight: 640 }}>{t.title}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-ghost)", flexShrink: 0 }}>{relTime(t.ts)}</span>
        </div>
        {showPrompt && <div className="clip" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 2 }}>{t.prompt}</div>}
        <div className="clip" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
          {t.agent} · {t.kind}{from ? ` · ${from}` : ""}
        </div>
        {t.error && <div style={{ fontSize: 11.5, color: "var(--err)", marginTop: 3, overflowWrap: "anywhere",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.error}</div>}
      </div>
    </button>
  );
}

export function Tasks({ nav }: ScreenProps) {
  const d = useData();
  const { tasks, crons, ready } = d;
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [kind, setKind] = useState("");
  const [agent, setAgent] = useState("");
  const [q, setQ] = useState("");
  // List on phones, board on wide screens, unless the viewer picked one
  const [view, setView] = useState<"list" | "board">("list");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch {}
    setView(saved === "board" || saved === "list" ? saved : window.innerWidth >= 900 ? "board" : "list");
  }, []);
  const pickView = (v: "list" | "board") => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };

  const sorted = [...tasks].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  const kinds = [...new Set(tasks.map(t => t.kind))];
  const agents = [...new Set(tasks.map(t => t.agent))];
  const needle = q.trim().toLowerCase();
  const filtered = sorted.filter(t =>
    (!status || t.status === status) && (!kind || t.kind === kind) && (!agent || t.agent === agent) &&
    (!needle || `${t.title} ${t.prompt} ${t.error ?? ""} ${t.result ?? ""}`.toLowerCase().includes(needle)));
  const count = (s: TaskStatus) => tasks.filter(t => t.status === s).length;
  const open = (t: Task) => nav.push("taskDetail", { id: t.id });
  const columns = STATUS_ORDER.filter(s => s !== "cancelled" || count("cancelled") > 0);

  const sub = !ready.tasks ? "Loading…" : `${tasks.length} tracked${count("running") ? ` · ${count("running")} running` : ""}${count("failed") ? ` · ${count("failed")} failed` : ""}`;
  const empty = (
    <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>
      {!ready.tasks ? "Loading tasks…" : tasks.length === 0 ? "No tasks yet. Start one with New Task." : "No tasks match these filters"}
    </div>
  );

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Tasks" sub={sub}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ConnectionBadge />
            <button className="tap" onClick={() => nav.push("createTask")}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 100, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 660 }}>
              <Icon name="plus" size={14} stroke={2.4} />New
            </button>
          </div>
        } />
      <OfflineBanner pageName="Tasks" />

      {/* Search + view toggle */}
      <div style={{ padding: "0 18px 12px", display: "flex", gap: 8 }}>
        <div className="glass" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 42, borderRadius: 13 }}>
          <Icon name="search" size={16} style={{ color: "var(--text-faint)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks, results, errors…"
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14, fontFamily: "inherit" }} />
          {q && <button className="tap" onClick={() => setQ("")} style={{ color: "var(--text-ghost)", padding: 4 }}><Icon name="x" size={14} /></button>}
        </div>
        <div style={{ display: "flex", padding: 3, borderRadius: 12, background: "var(--surface-2)", flexShrink: 0 }}>
          {(["list", "board"] as const).map(v => (
            <button key={v} className="tap" onClick={() => pickView(v)} title={v === "list" ? "List" : "Board"}
              style={{ width: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                background: view === v ? "var(--surface-solid)" : "transparent", color: view === v ? "var(--text)" : "var(--text-faint)" }}>
              <Icon name={v === "list" ? "list" : "columns"} size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "0 18px 10px", scrollbarWidth: "none" }}>
        <Chip active={status === ""} onClick={() => setStatus("")}>All <span style={{ opacity: 0.6 }}>{tasks.length}</span></Chip>
        {STATUS_ORDER.filter(s => count(s) > 0).map(s => (
          <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? "" : s)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color={STATUS_META[s].color} size={6} />{STATUS_META[s].label} <span style={{ opacity: 0.6 }}>{count(s)}</span></span>
          </Chip>
        ))}
      </div>
      {(kinds.length > 1 || agents.length > 1) && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "0 18px 14px", scrollbarWidth: "none" }}>
          {kinds.length > 1 && kinds.map(k => <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? "" : k)}>{k}</Chip>)}
          {agents.length > 1 && agents.map(a => <Chip key={a} active={agent === a} onClick={() => setAgent(agent === a ? "" : a)}>@{a}</Chip>)}
        </div>
      )}

      {view === "list" ? (
        <div className="pad">
          {filtered.length ? (
            <div className="card" style={{ padding: "2px 14px" }}>
              {filtered.map((t, i) => <TaskRow key={t.id} t={t} crons={crons} last={i === filtered.length - 1} onOpen={() => open(t)} />)}
            </div>
          ) : empty}
        </div>
      ) : (
        <div className="kanban" style={{ display: "flex", gap: 13, overflowX: "auto", padding: "0 18px 24px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
          {columns.filter(s => !status || s === status).map(s => {
            const col = filtered.filter(t => t.status === s);
            return (
              <div key={s} className="kanban-col" style={{ width: 270, flexShrink: 0, scrollSnapAlign: "start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 12px" }}>
                  <Dot color={STATUS_META[s].color} size={8} />
                  <span style={{ fontSize: 14, fontWeight: 680, letterSpacing: -0.2 }}>{STATUS_META[s].label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 600 }}>{col.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {col.map(t => <div key={t.id} className="card"><TaskRow t={t} crons={crons} compact onOpen={() => open(t)} /></div>)}
                  {!col.length && <div style={{ padding: "18px 0", textAlign: "center", fontSize: 12, color: "var(--text-ghost)", borderRadius: 14, border: "1.5px dashed var(--border)" }}>None</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
