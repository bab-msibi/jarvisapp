// Background sampler: the last 30 minutes of CPU / RAM / GPU, so the dashboard's charts
// are already full when the page opens
import os from "node:os";
import { gpuPct, ramUsedFrom, vmStat } from "./system";

export interface Sample { t: number; cpu: number; ram: number; gpu: number | null }

const EVERY_MS = 30000;
const KEEP = 60;

const g = globalThis as typeof globalThis & { __jarvisHistory?: { samples: Sample[]; timer?: NodeJS.Timeout } };
const state = (g.__jarvisHistory ??= { samples: [] });

// CPU busy % across all cores since the previous call (os.cpus() tick counters, no process spawn)
let prev = os.cpus().map((c) => c.times);
function cpuSince() {
  const now = os.cpus().map((c) => c.times);
  let busy = 0, total = 0;
  now.forEach((t, i) => {
    const p = prev[i] ?? t;
    const idle = t.idle - p.idle;
    const all = t.user - p.user + t.nice - p.nice + t.sys - p.sys + t.irq - p.irq + idle;
    busy += all - idle;
    total += all;
  });
  prev = now;
  return total ? Math.round((busy / total) * 100) : 0;
}

async function sample() {
  try {
    const [vm, gpu] = await Promise.all([vmStat(), gpuPct()]);
    state.samples.push({ t: Date.now(), cpu: cpuSince(), ram: Math.round((ramUsedFrom(vm) / os.totalmem()) * 100), gpu });
    if (state.samples.length > KEEP) state.samples.splice(0, state.samples.length - KEEP);
  } catch {}
}

export function startSampler() {
  if (state.timer) return;
  cpuSince();
  setTimeout(sample, 5000);
  state.timer = setInterval(sample, EVERY_MS);
  state.timer.unref();
}

export const history = () => state.samples;
