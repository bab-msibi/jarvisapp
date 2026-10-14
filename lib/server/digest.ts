// The daily digest written by scripts/daily-digest.py (launchd, 08:00), plus an on-demand run
import { spawn } from "node:child_process";
import { promises as fsP } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "digests");
const SCRIPT = path.join(process.cwd(), "scripts", "daily-digest.py");
const LOG = path.join(process.cwd(), "scripts", "daily-digest.log");

const g = globalThis as typeof globalThis & { __digestRun?: { startedAt: number; finishedAt: number | null; ok: boolean | null } };

export async function latestDigest() {
  const file = path.join(DIR, "latest.md");
  let markdown: string, mtime: number;
  try {
    [markdown, mtime] = await Promise.all([fsP.readFile(file, "utf8"), fsP.stat(file).then((s) => s.mtimeMs)]);
  } catch {
    return { digest: null, run: g.__digestRun ?? null };
  }
  const title = (markdown.match(/^# (.+)$/m) || [])[1] ?? "Daily Digest";
  const summary = (markdown.match(/^> (.+)$/m) || [])[1] ?? null;
  return {
    digest: {
      title: title.replace(/^Jarvis Daily Digest — /, ""),
      summary: summary && !summary.startsWith("_(") ? summary : null,
      markdown,
      generatedAt: mtime,
      // Written while the server was unreachable (before this fix the script filled in "?")
      broken: /\?%|up \?/.test(markdown),
    },
    run: g.__digestRun ?? null,
  };
}

// Runs the script detached from the request; its result lands in latest.md and the log
export function runDigest() {
  const cur = g.__digestRun;
  if (cur && !cur.finishedAt) return cur;
  const run = (g.__digestRun = { startedAt: Date.now(), finishedAt: null as number | null, ok: null as boolean | null });
  void fsP.open(LOG, "a").then((log) => {
    const child = spawn("/usr/bin/python3", [SCRIPT], { cwd: process.cwd(), stdio: ["ignore", log.fd, log.fd] });
    const done = (ok: boolean) => { run.finishedAt = Date.now(); run.ok = ok; void log.close(); };
    child.on("exit", (code) => done(code === 0));
    child.on("error", () => done(false));
  }).catch(() => { run.finishedAt = Date.now(); run.ok = false; });
  return run;
}
