"use client";

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiGet, apiPost, relTime } from "./api";
import type {
  Agent, CronJob, DeviceView, DigestResponse, ExecResult, FilesResponse, GatewayHealth, MarketResponse, McpStatus, Model, ModelConfig,
  OpenClawStatus, RawAgent, RawModel, RawTask, Session, SystemStats, Task, TunnelStatus, Whoami,
} from "./types";

// ── Adapters: raw OpenClaw JSON → UI shapes ─────────────────────────────────

const AGENT_COLORS = ["blue", "purple", "cyan", "green", "amber", "pink", "slate"];

function adaptAgent(a: RawAgent, sessions: Session[], crons: CronJob[]): Agent {
  const h = (a.id || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const agentSessions = sessions.filter((s) => s.agentId === a.id).sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0));
  const lastMs = agentSessions[0]?.updatedAt;
  const ageMs = lastMs ? Date.now() - lastMs : Infinity;
  const kinds = agentSessions.reduce<Record<string, number>>((acc, s) => {
    const k = s.kind || "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const kindStr = Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(" · ") || "no sessions";
  const agentCrons = crons.filter((c) => c.agentId === a.id);
  const activeCron = agentCrons.find((c) => c.enabled);
  return {
    id: a.id,
    name: a.identityName || a.id,
    emoji: a.identityEmoji || null,
    color: AGENT_COLORS[h % AGENT_COLORS.length],
    status: ageMs < 5 * 60 * 1000 ? "running" : "idle",
    task: activeCron ? `⏱ ${activeCron.name}` : kindStr,
    model: (a.model || "").replace(/^[^/]+\//, "") || "local",
    modelProvider: (a.model || "").split("/")[0] || "local",
    last: relTime(lastMs),
    lastMs,
    sessionCount: agentSessions.length,
    cronCount: agentCrons.length,
    bindings: a.bindings || 0,
    isDefault: !!a.isDefault,
    workspace: a.workspace,
    crons: agentCrons,
    sessions: agentSessions,
  };
}

const TASK_COL: Record<string, string> = { running: "In Progress", queued: "Pending", succeeded: "Completed", failed: "Completed", cancelled: "Waiting", timed_out: "Completed", lost: "Completed" };
const TASK_PRIO: Record<string, string> = { failed: "High", timed_out: "High", running: "High", queued: "Normal", succeeded: "Low", cancelled: "Low" };

function adaptTask(t: RawTask): Task {
  const due = t.endedAt ? new Date(t.endedAt).toLocaleDateString("en", { month: "short", day: "numeric" })
    : t.status === "running" ? "Running" : "Queued";
  return {
    id: t.taskId,
    // CLI tasks carry a "[Tue 2026-10-13 14:44 GMT+2] " stamp; the time is shown separately
    title: t.label || t.task?.replace(/^\[[^\]]*\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, "") || t.taskId,
    agent: t.agentId || "Agent",
    color: t.status === "failed" ? "amber" : "blue",
    priority: TASK_PRIO[t.status] || "Normal",
    due,
    col: TASK_COL[t.status] || "Pending",
    ...(t.status === "running" || t.status === "succeeded" ? { prog: t.status === "succeeded" ? 100 : 50 } : {}),
    ...(t.error ? { block: t.error } : {}),
    ts: t.lastEventAt || t.endedAt || t.createdAt,
  };
}

function adaptModel(m: RawModel, i: number): Model {
  const isDefault = m.tags.includes("default");
  return {
    id: m.key || `m${i}`,
    name: m.name,
    family: m.local ? "Local / Ollama" : "Remote",
    size: "–",
    status: m.available && isDefault ? "active" : m.available ? "loaded" : "available",
    agents: isDefault ? 1 : 0,
    vram: 0,
    ctx: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}K` : "–",
  };
}

// ── Dashboard data: every core endpoint, polled together ────────────────────

const POLL_MS = 15000;
const CORE = ["agents", "tasks", "models", "status", "sessions", "cron", "system", "health"] as const;

export interface DashboardData {
  agents: Agent[]; tasks: Task[]; models: Model[]; sessions: Session[]; crons: CronJob[];
  status: OpenClawStatus | null; sys: SystemStats | null;
  connected: boolean | null; loading: boolean; refresh: () => void;
  /** Per-source: false until that endpoint has answered once (so counts aren't shown as 0) */
  ready: Record<(typeof CORE)[number], boolean>;
}

export function useData(): DashboardData {
  const qc = useQueryClient();
  const results = useQueries({
    queries: CORE.map((name) => ({
      queryKey: [name],
      queryFn: () => apiGet<unknown>(`/api/${name}`),
      refetchInterval: POLL_MS,
    })),
  });
  const [agentsQ, tasksQ, modelsQ, statusQ, sessionsQ, cronQ, sysQ, healthQ] = results;
  const settled = results.every((r) => !r.isPending);
  const anyOk = [healthQ, agentsQ, tasksQ, modelsQ, statusQ].some((r) => r.isSuccess);

  const sessions = (sessionsQ.data as { sessions?: Session[] } | undefined)?.sessions ?? [];
  const crons = (cronQ.data as { jobs?: CronJob[] } | undefined)?.jobs ?? [];
  return {
    agents: ((agentsQ.data as { agents?: RawAgent[] } | undefined)?.agents ?? []).map((a) => adaptAgent(a, sessions, crons)),
    tasks: ((tasksQ.data as { tasks?: RawTask[] } | undefined)?.tasks ?? []).map(adaptTask),
    models: ((modelsQ.data as { models?: RawModel[] } | undefined)?.models ?? []).map(adaptModel),
    sessions,
    crons,
    status: (statusQ.data as OpenClawStatus | undefined) ?? null,
    sys: (sysQ.data as SystemStats | undefined) ?? null,
    connected: settled ? anyOk : null,
    loading: !settled,
    ready: Object.fromEntries(CORE.map((name, i) => [name, results[i].data !== undefined])) as DashboardData["ready"],
    refresh: () => CORE.forEach((name) => qc.invalidateQueries({ queryKey: [name] })),
  };
}

// ── Per-screen queries ──────────────────────────────────────────────────────

export const useSystem = () =>
  useQuery({ queryKey: ["system"], queryFn: () => apiGet<SystemStats>("/api/system"), refetchInterval: 8000 });

const FILES_PAGE = 60;

export function useFiles(q: string, folder: string, type: string, sort: string, content: boolean) {
  return useInfiniteQuery({
    queryKey: ["files", q, folder, type, sort, content],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(FILES_PAGE), offset: String(pageParam), sort });
      if (q) params.set("q", q);
      if (q && content) params.set("content", "1");
      if (folder) params.set("folder", folder);
      if (type) params.set("type", type);
      return apiGet<FilesResponse>(`/api/files?${params}`);
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.files.length < last.total ? last.offset + last.files.length : undefined),
    placeholderData: keepPreviousData,
  });
}

export const useRevealFile = () => useMutation({ mutationFn: (id: string) => apiPost<{ ok: true }>("/api/files/reveal", { id }) });

export function useDigest() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["digest"],
    queryFn: () => apiGet<DigestResponse>("/api/digest"),
    // Poll while a regeneration is running
    refetchInterval: (q) => (q.state.data?.run && !q.state.data.run.finishedAt ? 4000 : 300000),
  });
  const regenerate = useMutation({
    mutationFn: () => apiPost<{ run: DigestResponse["run"] }>("/api/digest"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["digest"] }),
  });
  return { ...query, regenerate };
}

export const useMarket = () =>
  useQuery({ queryKey: ["market"], queryFn: () => apiGet<MarketResponse>("/api/market"), refetchInterval: 60000 });

export const useDevices = () =>
  useQuery({ queryKey: ["devices"], queryFn: () => apiGet<{ devices: DeviceView[] }>("/api/devices"), refetchInterval: 5000 });

export function useDeviceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id }: { action: "approve" | "remove"; id: string }) => apiPost(`/api/devices/${action}`, { id }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
}

export const useMcpStatus = () => useQuery({ queryKey: ["mcp"], queryFn: () => apiGet<McpStatus>("/api/mcp") });

export function useInstallDesktopMcp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<McpStatus>("/api/mcp/install-desktop"),
    onSuccess: (data) => qc.setQueryData(["mcp"], data),
  });
}

export const useExec = () => useMutation({ mutationFn: (command: string) => apiPost<ExecResult>("/api/exec", { command }) });

export interface ChatJob {
  id: string; agentId: string; sessionKey: string | null; model: string | null;
  status: "running" | "done" | "error"; reply: string | null; error: string | null;
  usedModel: string | null; startedAt: number; finishedAt: number | null;
}

export const startChat = (v: { agentId: string; message: string; sessionKey: string; model?: string | null }) =>
  apiPost<{ job: ChatJob }>("/api/agent/chat", { ...v, model: v.model || undefined, async: true });

export const useWhoami = () => useQuery({ queryKey: ["whoami"], queryFn: () => apiGet<Whoami>("/api/whoami"), staleTime: 60000 });

export const useGateway = () =>
  useQuery({ queryKey: ["gateway"], queryFn: () => apiGet<GatewayHealth>("/api/gateway"), refetchInterval: 30000 });

export const useModelConfig = () => useQuery({ queryKey: ["modelConfig"], queryFn: () => apiGet<ModelConfig>("/api/models/config") });

export function useSetDefaultModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (model: string) => apiPost<ModelConfig>("/api/models/default", { model }),
    onSuccess: (data) => {
      qc.setQueryData(["modelConfig"], data);
      ["models", "status", "agents"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useTunnel() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tunnel"], queryFn: () => apiGet<TunnelStatus>("/api/tunnel"), refetchInterval: 60000 });
  // Re-run the live checks on demand (bypasses the server's cache)
  const recheck = () => qc.fetchQuery({ queryKey: ["tunnel"], queryFn: () => apiGet<TunnelStatus>("/api/tunnel?refresh=1"), staleTime: 0 });
  return { ...query, recheck };
}
