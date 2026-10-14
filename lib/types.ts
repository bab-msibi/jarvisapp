// Shapes shared between the API routes and the UI. Where a route returns a
// server function's result directly, its type is derived from that function.
import type { latestDigest } from "@/lib/server/digest";
import type { recentFiles } from "@/lib/server/files";
import type { marketData } from "@/lib/server/market";
import type { mcpStatus } from "@/lib/server/mcp";
import type { listModels } from "@/lib/server/openclaw";
import type { Sample } from "@/lib/server/history";
import type { systemStats } from "@/lib/server/system";
import type { execCommand } from "@/lib/server/terminal";
import type { view } from "@/lib/server/devices";
import type { appInfo, gatewayHealth, modelConfig, tunnelStatus } from "@/lib/server/insights";

export type SystemStats = Awaited<ReturnType<typeof systemStats>> & { history: Sample[] };
export type DigestResponse = Awaited<ReturnType<typeof latestDigest>>;
export type FilesResponse = Awaited<ReturnType<typeof recentFiles>>;
export type FileItem = FilesResponse["files"][number];
export type MarketResponse = ReturnType<typeof marketData>;
export type MarketSeries = MarketResponse["dax"];
export type McpStatus = ReturnType<typeof mcpStatus>;
export type ExecResult = Awaited<ReturnType<typeof execCommand>>;
export type DeviceView = ReturnType<typeof view>;
export type RawModel = Awaited<ReturnType<typeof listModels>>["models"][number];
export type GatewayHealth = Awaited<ReturnType<typeof gatewayHealth>>;
export type ModelConfig = Awaited<ReturnType<typeof modelConfig>>;
export type TunnelStatus = Awaited<ReturnType<typeof tunnelStatus>>;
export type Whoami = ReturnType<typeof appInfo> & {
  remote: boolean; device: DeviceView | null; email: string | null;
};

// Raw OpenClaw CLI JSON (only the fields the UI reads)
export interface RawAgent {
  id: string; identityName?: string; identityEmoji?: string; model?: string;
  bindings?: number; isDefault?: boolean; workspace?: string;
}
export interface Session {
  sessionId?: string; agentId?: string; kind?: string; updatedAt?: number; totalTokens?: number | null; key?: string;
  inputTokens?: number; outputTokens?: number; model?: string; contextTokens?: number; totalTokensFresh?: boolean;
}
export interface OpenClawStatus {
  runtimeVersion?: string;
  heartbeat?: { defaultAgentId?: string; agents?: { agentId: string; enabled: boolean; every?: string }[] };
  tasks?: { total: number; active: number; failures: number; byStatus?: Record<string, number>; byRuntime?: Record<string, number> };
  taskAudit?: { warnings: number; errors: number };
  sessions?: { count: number; defaults?: { model?: string; contextTokens?: number } };
}
export interface CronJob {
  id?: string; name: string; agentId?: string; enabled?: boolean;
  schedule?: { expr?: string; tz?: string };
  delivery?: { mode?: string; channel?: string };
  state?: { lastRunAtMs?: number; nextRunAtMs?: number; runningAtMs?: number; lastRunStatus?: string; consecutiveErrors?: number; lastDeliveryStatus?: string; lastDurationMs?: number };
  payload?: { kind?: string; message?: string; model?: string };
}
export interface RawTask {
  taskId: string; status: string; label?: string; task?: string; agentId?: string; error?: string;
  runtime?: string; taskKind?: string; sourceId?: string; requesterSessionKey?: string; runId?: string;
  createdAt?: number; startedAt?: number; endedAt?: number; lastEventAt?: number;
  deliveryStatus?: string; progressSummary?: string; terminalSummary?: string;
}

// UI-side shapes (adapted from the raw data)
export interface Agent {
  id: string; name: string; emoji: string | null; color: string; status: "running" | "idle";
  /** What it's doing right now ("" when idle) */
  task: string; model: string; modelProvider: string; last: string; lastMs?: number;
  sessionCount: number; cronCount: number; bindings: number; isDefault: boolean; workspace?: string;
  crons: CronJob[]; sessions: Session[];
}
export type TaskStatus = "running" | "queued" | "succeeded" | "failed" | "cancelled";
/** What started a task: a cron run, the New Task screen, an app chat, or another session */
export type TaskOrigin =
  | { type: "cron"; jobId: string; runId?: string }
  | { type: "task" | "chat" | "session"; sessionKey: string };
export interface Task {
  id: string;
  /** Short heading: OpenClaw's label ("Image generation") or the prompt itself */
  title: string;
  /** The full request, without the CLI's "[Tue 2026-…]" stamp */
  prompt: string;
  agent: string; status: TaskStatus; rawStatus: string;
  kind: string; runtime: string;
  ts?: number; createdAt?: number; startedAt?: number; endedAt?: number;
  error?: string; result?: string; deliveryStatus?: string;
  origin: TaskOrigin | null;
}
export interface Model {
  id: string; name: string; family: string; size: string; status: "active" | "loaded" | "available";
  agents: number; vram: number; ctx: string;
}
