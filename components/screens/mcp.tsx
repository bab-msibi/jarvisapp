"use client";

import { useState } from "react";
import { Btn, GhostBtn, Icon, Pill, Row, Section, TopBar } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";
import { useInstallDesktopMcp, useMcpStatus } from "@/lib/queries";

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div style={{ position: "relative" }}>
      <pre className="mono" style={{ margin: 0, padding: "12px 44px 12px 12px", background: "var(--surface-2)", borderRadius: 11, fontSize: 11.5, lineHeight: 1.55, overflowX: "auto", whiteSpace: "pre" }}>{text}</pre>
      <button className="tap" onClick={copy} title="Copy" style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", color: copied ? "var(--ok)" : "var(--text-dim)" }}>
        <Icon name={copied ? "check" : "doc"} size={15} stroke={2} />
      </button>
    </div>
  );
}

const status = (ok: boolean, label: string) => <Pill tone={ok ? "ok" : "neutral"}>{ok && <Icon name="check" size={11} stroke={2.6} />}{label}</Pill>;

export function ClaudeMcp({ nav }: ScreenProps) {
  const { data: info, error: loadError, refetch } = useMcpStatus();
  const install = useInstallDesktopMcp();
  const busy = install.isPending;
  const err = install.error?.message ?? loadError?.message;
  const load = () => void refetch();
  const installDesktop = () => install.mutate();

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Claude MCP" sub="Let Claude use Jarvis as a tool" right={<GhostBtn icon="refresh" size={38} onClick={load} />} />
      <div className="pad">
        {err && <div className="card" style={{ padding: 13, marginBottom: 14, color: "var(--err)", fontSize: 13 }}>{err}</div>}
        {!info && !err && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Loading…</div>}
        {info && <>
          <div className="card" style={{ padding: 16, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--warn-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--warn)" }}><Icon name="spark" size={22} stroke={1.8} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 680 }}>MCP server “{info.name}”</div>
                <div className="mono clip" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{info.script}</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: "12px 0 0", lineHeight: 1.5 }}>Claude launches this server itself. Keep Jarvis running (<span className="mono">npm start</span>) so its tools return live data.</p>
          </div>

          <Section title="Claude Desktop" />
          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{info.desktop.appFound ? "Claude Desktop detected" : "Claude Desktop not found"}</span>
              {status(info.desktop.installed, info.desktop.installed ? "Installed" : "Not installed")}
            </div>
            <Btn full icon={info.desktop.installed ? "refresh" : "plus"} disabled={busy} onClick={installDesktop}>
              {busy ? "Saving…" : info.desktop.installed ? "Reinstall in Claude Desktop" : "Add to Claude Desktop"}
            </Btn>
            <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Updates <span className="mono">claude_desktop_config.json</span> (a <span className="mono">.bak</span> copy is kept). Quit and reopen Claude Desktop afterwards.
            </p>
          </div>

          <Section title="Claude Code" />
          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {status(info.code.projectInstalled, "This project")}
              {status(info.code.userInstalled, "All projects")}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 8 }}>To use it in every project, run:</div>
            <CodeBlock text={info.code.command} />
          </div>

          <Section title="Manual config" />
          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 8 }}>For any other MCP client:</div>
            <CodeBlock text={JSON.stringify(info.config, null, 2)} />
          </div>

          <Section title={`Tools (${info.tools.length})`} />
          <div className="card" style={{ padding: "2px 14px" }}>
            {info.tools.map((t, i) => (
              <Row key={t.name} last={i === info.tools.length - 1} icon="code" iconColor="var(--accent)" title={<span className="mono" style={{ fontSize: 13 }}>{t.name}</span>} sub={t.description} />
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}
