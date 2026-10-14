// Demo data for screens that don't have a live OpenClaw source yet
import type { IconName, Tone } from "@/components/ui/primitives";
import type { Model } from "@/lib/types";

export interface MockAgent {
  id: string; name: string; color: string; icon: IconName; status: string; task: string;
  model: string; cpu: number; mem: number; last: string; priority: string;
}
export interface Activity { id: number; agent: string; color: string; icon: IconName; tone: Tone; text: string; time: string; meta: string }
export interface MockFile { id: string; name: string; type: string; size: string; agent: string; color: string; time: string; ai: boolean }

export const AGENTS: MockAgent[] = [
  { id: "research", name: "Research Agent", color: "blue", icon: "search", status: "running", task: "Compiling market analysis on wearables", model: "Qwen2.5-72B", cpu: 34, mem: 4.2, last: "now", priority: "High" },
  { id: "coding", name: "Coding Agent", color: "purple", icon: "code", status: "running", task: "Refactoring auth module · 14 files", model: "DeepSeek-V3", cpu: 61, mem: 7.8, last: "now", priority: "High" },
  { id: "marketing", name: "Marketing Agent", color: "pink", icon: "spark", status: "idle", task: "Awaiting campaign brief", model: "Llama-3.3-70B", cpu: 2, mem: 1.1, last: "12m ago", priority: "Normal" },
  { id: "support", name: "Support Agent", color: "cyan", icon: "message", status: "running", task: "Triaging 8 inbound tickets", model: "Mistral-Large", cpu: 18, mem: 2.4, last: "now", priority: "Normal" },
  { id: "finance", name: "Finance Agent", color: "green", icon: "chart", status: "paused", task: "Q2 burn-rate reconciliation", model: "Qwen2.5-72B", cpu: 0, mem: 3.0, last: "1h ago", priority: "Low" },
  { id: "automation", name: "Automation Agent", color: "amber", icon: "bolt", status: "running", task: "Nightly backup + 3 scheduled jobs", model: "Gemma-2-27B", cpu: 9, mem: 1.8, last: "now", priority: "Normal" },
  { id: "design", name: "Design Agent", color: "slate", icon: "edit", status: "idle", task: "Idle · no active assignment", model: "Llama-3.3-70B", cpu: 1, mem: 0.9, last: "34m ago", priority: "Low" },
];

export const STATUS_TONE: Record<string, Tone> = { running: "ok", idle: "neutral", paused: "warn", error: "err", offline: "neutral" };

export const ACTIVITY: Activity[] = [
  { id: 1, agent: "Coding Agent", color: "purple", icon: "check", tone: "ok", text: "Completed task “Refactor auth module”", time: "2m", meta: "14 files changed" },
  { id: 2, agent: "Research Agent", color: "blue", icon: "doc", tone: "info", text: "Generated report market-analysis-q2.pdf", time: "6m", meta: "2.4 MB" },
  { id: 3, agent: "Automation Agent", color: "amber", icon: "bolt", tone: "warn", text: "Scheduled job “nightly-sync” started", time: "11m", meta: "" },
  { id: 4, agent: "Support Agent", color: "cyan", icon: "message", tone: "cyan", text: "Resolved ticket #4821 — refund processed", time: "18m", meta: "" },
  { id: 5, agent: "System", color: "slate", icon: "cpu", tone: "err", text: "GPU memory pressure on Mac Studio", time: "24m", meta: "91% VRAM" },
  { id: 6, agent: "Finance Agent", color: "green", icon: "pause", tone: "warn", text: "Paused by user — awaiting approval", time: "1h", meta: "" },
];


export const FILES: MockFile[] = [
  { id: "f1", name: "market-analysis-q2.pdf", type: "pdf", size: "2.4 MB", agent: "Research Agent", color: "blue", time: "6m ago", ai: true },
  { id: "f2", name: "auth-module.refactor.zip", type: "zip", size: "840 KB", agent: "Coding Agent", color: "purple", time: "2m ago", ai: true },
  { id: "f3", name: "campaign-brief.docx", type: "docx", size: "128 KB", agent: "You", color: "slate", time: "1h ago", ai: false },
  { id: "f4", name: "burn-rate-q2.xlsx", type: "xlsx", size: "92 KB", agent: "Finance Agent", color: "green", time: "1h ago", ai: true },
  { id: "f5", name: "brand-styleguide.fig.pdf", type: "pdf", size: "5.1 MB", agent: "Design Agent", color: "slate", time: "3h ago", ai: true },
  { id: "f6", name: "support-export.csv", type: "csv", size: "44 KB", agent: "Support Agent", color: "cyan", time: "5h ago", ai: true },
  { id: "f7", name: "server-config.txt", type: "txt", size: "3 KB", agent: "You", color: "slate", time: "Yesterday", ai: false },
  { id: "f8", name: "hero-render.png", type: "png", size: "1.8 MB", agent: "Design Agent", color: "slate", time: "Yesterday", ai: true },
];
export const FILE_TONE: Record<string, Tone> = { pdf: "err", zip: "warn", docx: "info", xlsx: "ok", csv: "ok", txt: "neutral", png: "purple", jpg: "purple", code: "cyan" };

export const MODELS: Model[] = [
  { id: "m1", name: "Qwen2.5-72B-Instruct", family: "Qwen", size: "42 GB", status: "active", agents: 2, vram: 38, ctx: "128K" },
  { id: "m2", name: "DeepSeek-V3", family: "DeepSeek", size: "37 GB", status: "active", agents: 1, vram: 34, ctx: "64K" },
  { id: "m3", name: "Llama-3.3-70B", family: "Llama", size: "40 GB", status: "loaded", agents: 2, vram: 0, ctx: "128K" },
  { id: "m4", name: "Mistral-Large-2411", family: "Mistral", size: "44 GB", status: "active", agents: 1, vram: 22, ctx: "128K" },
  { id: "m5", name: "Gemma-2-27B", family: "Gemma", size: "16 GB", status: "loaded", agents: 1, vram: 0, ctx: "8K" },
  { id: "m6", name: "DeepSeek-R1-Distill", family: "DeepSeek", size: "9 GB", status: "available", agents: 0, vram: 0, ctx: "32K" },
];
