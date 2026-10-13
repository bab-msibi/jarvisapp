"use client";

import { useState } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Bar, Dot, Header, Icon, Section, type IconName } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import type { ScreenProps } from "@/lib/nav";
import { useData, useFiles } from "@/lib/queries";
import type { FileItem } from "@/lib/types";

const EXT_COLOR: Record<string, string> = {
  md: "var(--accent)", txt: "var(--text-dim)", pdf: "var(--err)",
  png: "var(--purple)", jpg: "var(--purple)", jpeg: "var(--purple)", svg: "var(--purple)",
  zip: "var(--warn)", ts: "var(--cyan)", js: "var(--cyan)", mjs: "var(--cyan)",
  json: "var(--ok)", csv: "var(--ok)", xlsx: "var(--ok)",
  mp4: "var(--pink)", mp3: "var(--pink)",
};
const EXT_ICON: Record<string, IconName> = {
  png: "image", jpg: "image", jpeg: "image", svg: "image",
  mp4: "play", mp3: "play",
  zip: "archive", pdf: "doc",
  ts: "code", js: "code", mjs: "code", tsx: "code", jsx: "code",
  json: "code", md: "doc", txt: "doc", csv: "doc",
};

function FileRow({ f, last }: { f: FileItem; last: boolean }) {
  const color = EXT_COLOR[f.ext] || "var(--text-faint)";
  const icon = EXT_ICON[f.ext] || "doc";
  const ago = relTime(f.modified);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
        <Icon name={icon} size={17} stroke={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clip" style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 2 }}>
          <span className="mono" style={{ fontSize: 10.5, color, background: `color-mix(in oklab, ${color} 12%, transparent)`, padding: "1px 5px", borderRadius: 4, marginRight: 6 }}>{f.ext.toUpperCase()}</span>
          {f.sizeStr}
          {f.dir && f.dir !== "/" && <span style={{ color: "var(--text-ghost)", marginLeft: 6 }}>· {f.dir}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, color: "var(--text-ghost)" }}>{ago}</div>
      </div>
    </div>
  );
}

export function Files(_: ScreenProps) {
  const { sys } = useData();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const { data, isPending: loading } = useFiles(q, folder);

  const files = data?.files || [];
  const folders = data?.folders || [];
  const diskPct = sys?.diskPct ?? 0;
  const diskUsed = sys?.diskUsedGb ?? "–";
  const diskTotal = sys?.diskTotalGb ?? "–";

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Files" sub={data ? `${data.allTotal.toLocaleString()} files · ${data.workspaceMb} MB` : "Workspace"} right={<ConnectionBadge />} />
      <OfflineBanner pageName="Files" />

      {/* Search */}
      <div style={{ padding: "0 18px 14px" }}>
        <div className="glass" style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 14px", height: 44, borderRadius: 13 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-faint)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5, fontFamily: "inherit" }} />
          {q && <button className="tap" onClick={() => setQ("")} style={{ color: "var(--text-ghost)", padding: 4 }}><Icon name="x" size={15} /></button>}
        </div>
      </div>

      <div className="pad">
        {/* Disk card — real data from /api/system */}
        <div className="card" style={{ padding: 15, marginBottom: 16 }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 620 }}>Mac Disk</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{diskUsed} / {diskTotal} GB</span>
          </div>
          <Bar value={diskPct} color="var(--accent)" h={7} />
          <div style={{ display: "flex", gap: 16, marginTop: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Dot color="var(--accent)" size={7} />
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>Used {diskPct}%</span>
            </div>
            {data && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color="var(--purple)" size={7} />
                <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>Workspace {data.workspaceMb} MB</span>
              </div>
            )}
          </div>
        </div>

        {/* Folder pills */}
        {folders.length > 0 && !q && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", marginBottom: 8 }}>FOLDERS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="tap" onClick={() => setFolder("")}
                style={{ padding: "6px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
                  background: folder === "" ? "var(--accent)" : "var(--surface)",
                  color: folder === "" ? "#fff" : "var(--text-dim)",
                  border: folder === "" ? "none" : "1px solid var(--border)" }}>
                All
              </button>
              {folders.filter(f => !["MEMORY.md","Untitled.canvas","Untitled.base"].includes(f.name)).map(f => (
                <button key={f.name} className="tap" onClick={() => setFolder(folder === f.name ? "" : f.name)}
                  style={{ padding: "6px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
                    background: folder === f.name ? "var(--accent)" : "var(--surface)",
                    color: folder === f.name ? "#fff" : "var(--text-dim)",
                    border: folder === f.name ? "none" : "1px solid var(--border)" }}>
                  {f.name} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File list */}
        <Section title={q ? `Results for "${q}"` : folder ? `/${folder}` : "Recent Files"} />
        <div className="card file-grid" style={{ padding: "0 14px" }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13, gridColumn: "1 / -1" }}>Loading files…</div>
          ) : files.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13, gridColumn: "1 / -1" }}>
              {q ? `No files matching "${q}"` : "No files found"}
            </div>
          ) : files.map((f, i) => <FileRow key={f.id} f={f} last={i === files.length - 1} />)}
        </div>
        {data && data.total > 60 && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12.5, color: "var(--text-ghost)" }}>
            Showing 60 of {data.total.toLocaleString()} files
          </div>
        )}
      </div>
    </div>
  );
}
