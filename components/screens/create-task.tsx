"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Btn, Icon, TopBar } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { startChat, useData, useModelConfig, type ChatJob } from "@/lib/queries";

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 8, marginLeft: 2, letterSpacing: 0.2 }}>{children}</div>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="tap" onClick={onClick}
      style={{ padding: "7px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
        background: active ? "var(--accent)" : "var(--surface)", color: active ? "#fff" : "var(--text-dim)",
        border: active ? "none" : "1px solid var(--border)" }}>
      {children}
    </button>
  );
}

// A task is a one-off agent turn in its own session, so it doesn't land in the agent's main chat.
// It runs as a background job on the server; OpenClaw lists it under Tasks either way.
export function CreateTask({ nav }: ScreenProps) {
  const qc = useQueryClient();
  const { agents } = useData();
  const { data: mc } = useModelConfig();
  const [agentId, setAgentId] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const agent = agents.find(a => a.id === agentId) || agents.find(a => a.isDefault) || agents[0];
  const { data: job } = useQuery({
    queryKey: ["taskJob", jobId],
    queryFn: () => apiGet<{ job: ChatJob }>(`/api/agent/chat/jobs/${jobId}`).then(r => r.job),
    enabled: !!jobId,
    refetchInterval: q => (q.state.data?.status === "running" ? 3000 : false),
  });
  const running = starting || job?.status === "running";
  // Re-render every second while running so the elapsed time counts up
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Refresh the task list once the run finishes
  useEffect(() => {
    if (job && job.status !== "running") qc.invalidateQueries({ queryKey: ["tasks"] });
  }, [job, qc]);

  async function submit() {
    if (!agent || !prompt.trim()) return;
    setStarting(true);
    setError(null);
    try {
      const sessionKey = `agent:${agent.id}:task-${Date.now().toString(36)}`;
      const { job } = await startChat({ agentId: agent.id, message: prompt.trim(), sessionKey, model: model || null });
      setJobId(job.id);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const secs = job ? Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000) : 0;

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="New Task" sub="A one-off job for an agent" />
      <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
        <div>
          <Label>WHAT SHOULD IT DO?</Label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} disabled={!!jobId} rows={5}
            placeholder="e.g. Summarise today's football headlines for the SoccerZone channel"
            className="glass"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 13, resize: "vertical", minHeight: 110,
              color: "var(--text)", fontSize: 14.5, fontFamily: "inherit", lineHeight: 1.45, outline: "none" }} />
        </div>

        <div>
          <Label>AGENT</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {agents.length === 0 && <span style={{ fontSize: 13, color: "var(--text-ghost)" }}>Loading agents…</span>}
            {agents.map(a => (
              <Choice key={a.id} active={agent?.id === a.id} onClick={() => !jobId && setAgentId(a.id)}>
                {a.emoji ? `${a.emoji} ` : ""}{a.name}
              </Choice>
            ))}
          </div>
        </div>

        <div>
          <Label>MODEL</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Choice active={model === ""} onClick={() => !jobId && setModel("")}>Agent default{agent?.model ? ` · ${agent.model.split("/").pop()}` : ""}</Choice>
            {(mc?.chatModels ?? []).filter(m => m !== mc?.defaultModel).map(m => (
              <Choice key={m} active={model === m} onClick={() => !jobId && setModel(m)}>{m.split("/").pop()}</Choice>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-ghost)", margin: "8px 2px 0" }}>Local models run on this Mac&apos;s CPU and can take a minute or more.</div>
        </div>

        {error && <div style={{ fontSize: 13, color: "var(--err)" }}>{error}</div>}

        {!jobId ? (
          <Btn full size="lg" icon="play" onClick={submit} disabled={!prompt.trim() || !agent || running}>{starting ? "Starting…" : "Run task"}</Btn>
        ) : (
          <div className="card" style={{ padding: 14 }}>
            <div className="between" style={{ marginBottom: job?.reply || job?.error ? 10 : 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 650,
                color: job?.status === "error" ? "var(--err)" : job?.status === "done" ? "var(--ok)" : "var(--text)" }}>
                <Icon name={job?.status === "error" ? "warn" : job?.status === "done" ? "check" : "clock"} size={16} />
                {job?.status === "error" ? "Failed" : job?.status === "done" ? "Done" : "Running…"}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--text-ghost)" }}>{secs}s{job?.usedModel ? ` · ${job.usedModel.split("/").pop()}` : ""}</span>
            </div>
            {job?.reply && <div style={{ fontSize: 13.5, color: "var(--text-dim)", whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: "40vh", overflow: "auto" }}>{job.reply}</div>}
            {job?.error && <div style={{ fontSize: 13, color: "var(--err)" }}>{job.error}</div>}
            {running && <div style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 6 }}>You can leave this screen; the task keeps running and shows up under Tasks.</div>}
          </div>
        )}
        {jobId && !running && (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full variant="glass" onClick={() => { setJobId(null); setPrompt(""); }}>New task</Btn>
            <Btn full onClick={() => nav.go("tasks")}>View tasks</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
