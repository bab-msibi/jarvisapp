"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { GhostBtn, Icon, TopBar } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";
import { useExec } from "@/lib/queries";

type LineKind = "cmd" | "out" | "ok" | "dim" | "err";
interface Line { t: LineKind; v: string; dir?: string }

const HOME = "/Users/admin";

export function Terminal({ nav }: ScreenProps) {
  const exec = useExec();
  const colorFor: Record<LineKind, string> = { cmd: "var(--text)", out: "var(--text-dim)", ok: "var(--ok)", dim: "var(--text-faint)", err: "var(--err)" };
  const short = (p: string) => {
    if (!p) return "~";
    const s = p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p;
    return s.replace(/^~$/, "~") || "/";
  };
  const [lines, setLines] = useState<Line[]>([
    { t: "dim", v: "Jarvis shell — commands run on your Mac via /api/exec." },
    { t: "dim", v: "Try: ls · pwd · openclaw status · df -h" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(HOME);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  const run = async () => {
    const command = input.trim();
    if (!command || busy) return;
    setHistory(h => [...h, command]);
    setHistIdx(-1);
    setInput("");

    if (command === "clear" || command === "cls") {
      setLines([]);
      return;
    }

    setLines(l => [...l, { t: "cmd", v: command, dir: short(cwd) }]);
    setBusy(true);
    try {
      const data = await exec.mutateAsync(command);
      const add: Line[] = [];
      if (data.stdout) data.stdout.split("\n").forEach(v => add.push({ t: "out", v }));
      if (data.stderr) data.stderr.split("\n").forEach(v => add.push({ t: "err", v }));
      if (!data.stdout && !data.stderr) {
        add.push({ t: data.code === 0 ? "ok" : "err", v: data.code === 0 ? "✓ done (no output)" : `exited with code ${data.code}` });
      } else if (data.code !== 0) {
        add.push({ t: "err", v: `exited with code ${data.code}` });
      }
      if (data.cwd) setCwd(data.cwd);
      setLines(l => [...l, ...add]);
    } catch (e) {
      setLines(l => [...l, { t: "err", v: (e as Error).message || "Command failed" }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); run(); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const i = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i); setInput(history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const i = histIdx + 1;
      if (i >= history.length) { setHistIdx(-1); setInput(""); }
      else { setHistIdx(i); setInput(history[i]); }
    }
  };

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Terminal" sub={`${short(cwd)} · zsh`} right={<GhostBtn icon="trash" size={38} onClick={() => setLines([])} />} />
      <div className="screen" style={{ flex: 1, margin: "0 14px", borderRadius: 18, overflow: "hidden", border: "1px solid var(--border)", background: "color-mix(in oklab, var(--bg) 70%, #000)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="between" style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6 }}>{["#fb6f70", "#fbbf24", "#34d399"].map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />)}</div>
          <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>admin@mac — {short(cwd)}</span>
          <span style={{ width: 30 }} />
        </div>
        <div ref={scrollRef} className="mono" style={{ flex: 1, padding: 14, fontSize: 12, lineHeight: 1.7, overflowY: "auto", minHeight: 0 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ color: colorFor[l.t], display: "flex", gap: 7 }}>
              {l.t === "cmd" && <span style={{ color: "var(--accent)", flexShrink: 0 }}>›</span>}
              <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l.v}</span>
            </div>
          ))}
          {busy && <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2, color: "var(--text-faint)" }}><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--surface-2)", borderTopColor: "var(--accent)", animation: "spin .7s linear infinite", display: "inline-block" }} /><span>running…</span></div>}
          {!busy && <div style={{ display: "flex", gap: 7, marginTop: 4 }}><span style={{ color: "var(--accent)" }}>›</span><span style={{ width: 8, height: 15, background: "var(--accent)", animation: "blink 1s steps(1) infinite", display: "inline-block" }} /></div>}
        </div>
      </div>
      <div style={{ padding: "10px 14px 12px", flexShrink: 0 }}>
        <div className="glass" style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 46, borderRadius: 14 }}>
          <span className="mono" style={{ color: "var(--accent)", fontSize: 14 }}>›</span>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} disabled={busy}
            placeholder="Enter command…" className="mono" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 13.5, opacity: busy ? 0.5 : 1 }} />
          <button className="tap" onClick={run} disabled={busy} style={{ color: busy ? "var(--text-ghost)" : "var(--accent)" }}><Icon name="send" size={18} /></button>
        </div>
      </div>
    </div>
  );
}
