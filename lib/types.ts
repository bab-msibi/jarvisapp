// Shapes shared between the API routes and the UI. Where a route returns a
// server function's result directly, its type is derived from that function.
import type { recentFiles } from "@/lib/server/files";
import type { marketData } from "@/lib/server/market";
import type { mcpStatus } from "@/lib/server/mcp";
import type { listModels } from "@/lib/server/openclaw";
import type { systemStats } from "@/lib/server/system";
import type { execCommand } from "@/lib/server/terminal";
import type { view } from "@/lib/server/devices";

export type SystemStats = Awaited<ReturnType<typeof systemStats>>;
export type FilesResponse = Awaited<ReturnType<typeof recentFiles>>;
export type FileItem = FilesResponse["files"][number];
export type MarketResponse = ReturnType<typeof marketData>;
export type MarketSeries = MarketResponse["dax"];
export type McpStatus = ReturnType<typeof mcpStatus>;
export type ExecResult = Awaited<ReturnType<typeof execCommand>>;
export type DeviceView = ReturnType<typeof view>;
export type RawModel = Awaited<ReturnType<typeof listModels>>["models"][number];

// Raw OpenClaw CLI JSON (only the fields the UI reads)
export interface RawAgent {
  id: string; identityName?: string; identityEmoji?: string; model?: string;
  bindings?: number; isDefault?: boolean; workspace?: string;
}
export interface Session {
  sessionId?: string; agentId?: string; kind?: string; updatedAt?: number; totalTokens?: number; key?: string;
}
export interface CronJob {
  id?: string; name: string; agentId?: string; enabled?: boolean;
  schedule?: { expr?: string; tz?: string };
  state?: { lastRunAtMs?: number; nextRunAtMs?: number; lastRunStatus?: string; consecutiveErrors?: number };
}
export interface RawTask {
  taskId: string; status: string; label?: string; task?: string; agentId?: string; endedAt?: number; error?: string;
}

// UI-side shapes (adapted from the raw data)
export interface Agent {
  id: string; name: string; emoji: string | null; color: string; status: "running" | "idle";
  task: string; model: string; modelProvider: string; last: string; lastMs?: number;
  sessionCount: number; cronCount: number; bindings: number; isDefault: boolean; workspace?: string;
  crons: CronJob[]; sessions: Session[];
}
export interface Task {
  id: string; title: string; agent: string; color: string; priority: string; due: string;
  col: string; prog?: number; block?: string;
}
export interface Model {
  id: string; name: string; family: string; size: string; status: "active" | "loaded" | "available";
  agents: number; vram: number; ctx: string;
}
