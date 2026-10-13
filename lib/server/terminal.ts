import { execFile } from "node:child_process";
import fs from "node:fs";

const SHELL = process.env.SHELL || "/bin/zsh";
const TIMEOUT = 60000;
const SENTINEL = "__JARVIS_CWD__";

// Working directory persists across commands for the life of the server process
const g = globalThis as typeof globalThis & { __jarvisTerm?: { cwd: string; baselineErr: string | null } };
const term = (g.__jarvisTerm ??= { cwd: process.env.HOME || process.cwd(), baselineErr: null });

interface ShellResult { stdout: string; stderr: string; cwd: string; code: number; timedOut: boolean }

function runShell(command: string, cwd: string) {
  const wrapped = `${command}\n__rc=$?; printf '\\n${SENTINEL}%s\\n' "$PWD"; exit $__rc`;
  return new Promise<ShellResult>((resolve) => {
    execFile(/*turbopackIgnore: true*/ SHELL, ["-lc", wrapped], { cwd, timeout: TIMEOUT, maxBuffer: 1024 * 1024 * 8, env: process.env }, (err, stdout, stderr) => {
      let out = stdout || "";
      let newCwd = cwd;
      const idx = out.lastIndexOf(SENTINEL);
      if (idx !== -1) {
        newCwd = (out.slice(idx + SENTINEL.length).split("\n")[0] || "").trim() || cwd;
        out = out.slice(0, idx).replace(/\n$/, "");
      }
      const e = err as (Error & { killed?: boolean; code?: string | number }) | null;
      const timedOut = !!(e && (e.killed || e.code === "ETIMEDOUT"));
      const code = timedOut ? 124 : e && typeof e.code === "number" ? e.code : e ? 1 : 0;
      resolve({ stdout: out, stderr: stderr || "", cwd: newCwd, code, timedOut });
    });
  });
}

export async function execCommand(command: string) {
  // A login shell sources the user's profile every time; capture its constant
  // startup stderr once and strip exactly that, so real errors still surface
  if (term.baselineErr === null) {
    try { term.baselineErr = (await runShell(":", term.cwd)).stderr; } catch { term.baselineErr = ""; }
  }
  const r = await runShell(command, term.cwd);
  let cwd = r.cwd;
  if (fs.existsSync(cwd)) term.cwd = cwd;
  else cwd = term.cwd;
  let stderr = r.stderr;
  if (term.baselineErr && stderr.startsWith(term.baselineErr)) stderr = stderr.slice(term.baselineErr.length);
  return {
    stdout: r.stdout,
    stderr: r.timedOut ? `Command timed out after ${TIMEOUT / 1000}s` : stderr,
    cwd,
    code: r.code,
    timedOut: r.timedOut,
  };
}
