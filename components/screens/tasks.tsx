"use client";

import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Avatar, Bar, Dot, Header, Icon, Pill, type Tone } from "@/components/ui/primitives";
import { COL_TONE, TASK_COLS, TASKS, type TaskCol } from "@/lib/mock-data";
import type { ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";
import type { Task } from "@/lib/types";

// Shown until OpenClaw reports real tasks
const DEMO_TASKS: Task[] = Object.entries(TASKS).flatMap(([col, ts]) => ts.map((t) => ({ ...t, col })));

const PRIORITY_TONE: Record<string, Tone> = { High: "err", Normal: "info", Low: "neutral" };
const TONE_DOT: Partial<Record<Tone, string>> = { neutral: "var(--text-faint)", info: "var(--accent)", warn: "var(--warn)", purple: "var(--purple)", ok: "var(--ok)" };

function TaskCard({ t, onClick }: { t: Task; onClick: () => void }) {
  const pr = PRIORITY_TONE[t.priority];
  return (
    <button className="tap card" onClick={onClick} style={{ padding: 13, width: "100%", textAlign: "left", display: "block", marginBottom: 9 }}>
      <div className="between" style={{ marginBottom: 9 }}><Pill tone={pr} style={{ fontSize: 10.5, padding: "3px 8px" }}>{t.priority}</Pill><span style={{ fontSize: 11, color: "var(--text-ghost)", fontWeight: 540 }}>{t.due}</span></div>
      <div style={{ fontSize: 13.5, fontWeight: 580, lineHeight: 1.35, marginBottom: 11 }}>{t.title}</div>
      {t.prog !== undefined && <div style={{ marginBottom: 11 }}><Bar value={t.prog} h={5} /></div>}
      {t.block && <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, color: "var(--warn)" }}><Icon name="clock" size={12} stroke={2} /><span style={{ fontSize: 11, fontWeight: 540 }}>{t.block}</span></div>}
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Avatar name={t.agent} color={t.color} size={22} /><span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 540 }} className="clip">{t.agent}</span></div>
    </button>
  );
}

export function Tasks({ nav }: ScreenProps) {
  const d = useData();
  const liveTasks = d.tasks.length ? d.tasks : DEMO_TASKS;
  const tasksByCol = Object.fromEntries(TASK_COLS.map((col) => [col, liveTasks.filter(t => t.col === col)])) as Record<TaskCol, Task[]>;
  return (
    <div className="screen anim-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Header title="Tasks" sub={`${liveTasks.length} total`} right={<ConnectionBadge />} />
      <OfflineBanner pageName="Tasks" />
      <div className="kanban" style={{ flex: 1, display: "flex", gap: 13, overflowX: "auto", padding: "0 18px 110px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
        {TASK_COLS.map(col => (
          <div key={col} className="kanban-col" style={{ width: 244, flexShrink: 0, scrollSnapAlign: "start" }}>
            <div className="between" style={{ padding: "0 4px 12px", position: "sticky", top: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Dot color={TONE_DOT[COL_TONE[col]]} size={8} />
                <span style={{ fontSize: 14, fontWeight: 680, letterSpacing: -0.2 }}>{col}</span>
                <span style={{ fontSize: 12, color: "var(--text-ghost)", fontWeight: 600 }}>{tasksByCol[col].length}</span>
              </div>
              <Icon name="plus" size={16} style={{ color: "var(--text-ghost)" }} />
            </div>
            {tasksByCol[col].map(t => <TaskCard key={t.id} t={t} onClick={() => nav.push("taskDetail", { id: t.id })} />)}
            {tasksByCol[col].length === 0 && <div style={{ height: 60, borderRadius: 14, border: "1.5px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-ghost)", fontSize: 12 }}>Drop here</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
