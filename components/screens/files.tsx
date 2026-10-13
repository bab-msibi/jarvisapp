"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Bar, Dot, Header, Icon, Sheet, type IconName } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import { PREVIEW_IMAGE, PREVIEW_TEXT, PREVIEW_TEXT_MAX } from "@/lib/file-types";
import type { ScreenProps } from "@/lib/nav";
import { useData, useFiles, useRevealFile, useWhoami } from "@/lib/queries";
import type { FileItem } from "@/lib/types";

const EXT_COLOR: Record<string, string> = {
  md: "var(--accent)", txt: "var(--text-dim)", pdf: "var(--err)",
  png: "var(--purple)", jpg: "var(--purple)", jpeg: "var(--purple)", svg: "var(--purple)",
  zip: "var(--warn)", ts: "var(--cyan)", js: "var(--cyan)", mjs: "var(--cyan)",
  json: "var(--ok)", csv: "var(--ok)", xlsx: "var(--ok)",
  mp4: "var(--pink)", mp3: "var(--pink)",
};
const TYPE_ICON: Record<string, IconName> = { image: "image", doc: "doc", code: "code", media: "play", archive: "archive" };
const TYPE_FILTERS = [
  { id: "", label: "All" }, { id: "image", label: "Images" }, { id: "doc", label: "Docs" },
  { id: "code", label: "Code" }, { id: "media", label: "Media" }, { id: "archive", label: "Archives" },
];
const SORTS = [{ id: "recent", label: "Recent" }, { id: "size", label: "Size" }, { id: "name", label: "Name" }];

const rawUrl = (f: FileItem, download = false) => `/api/files/raw?id=${encodeURIComponent(f.id)}${download ? "&download=1" : ""}`;
const mbStr = (mb: string) => (+mb >= 1024 ? `${(+mb / 1024).toFixed(1)} GB` : `${mb} MB`);
const iconFor = (f: FileItem): IconName => (f.ext === "pdf" ? "doc" : TYPE_ICON[f.type ?? ""] || "doc");

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="tap" onClick={onClick}
      style={{ padding: "6px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-dim)",
        border: active ? "none" : "1px solid var(--border)" }}>
      {children}
    </button>
  );
}

function FileRow({ f, last, onOpen }: { f: FileItem; last: boolean; onOpen: () => void }) {
  const color = EXT_COLOR[f.ext] || "var(--text-faint)";
  return (
    <button className="tap" onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", width: "100%", minWidth: 0, textAlign: "left",
      borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
        <Icon name={iconFor(f)} size={17} stroke={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clip" style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</div>
        <div className="clip" style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 2 }}>
          <span className="mono" style={{ fontSize: 10.5, color, background: `color-mix(in oklab, ${color} 12%, transparent)`, padding: "1px 5px", borderRadius: 4, marginRight: 6 }}>{f.ext.toUpperCase()}</span>
          {f.sizeStr}
          {f.dir && f.dir !== "/" && <span style={{ color: "var(--text-ghost)", marginLeft: 6 }}>· {f.dir}</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, color: "var(--text-ghost)" }}>{relTime(f.modified)}</div>
      </div>
    </button>
  );
}

function TextPreview({ f }: { f: FileItem }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(rawUrl(f)).then(r => (r.ok ? r.text() : Promise.reject())).then(t => live && setText(t), () => live && setError(true));
    return () => { live = false; };
  }, [f]);
  if (error) return <Empty>Couldn&apos;t load this file</Empty>;
  if (text === null) return <Empty>Loading…</Empty>;
  return (
    <pre className="mono" style={{ margin: 0, padding: 12, borderRadius: 12, background: "var(--surface-2)", fontSize: 11.5, lineHeight: 1.5,
      maxHeight: "45vh", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-dim)" }}>{text || "(empty file)"}</pre>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: 28, textAlign: "center", color: "var(--text-ghost)", fontSize: 13, borderRadius: 12, background: "var(--surface-2)" }}>{children}</div>;
}

function Preview({ f }: { f: FileItem }) {
  if (PREVIEW_IMAGE.has(f.ext)) {
    return <img src={rawUrl(f)} alt={f.name} style={{ display: "block", maxWidth: "100%", maxHeight: "45vh", margin: "0 auto", borderRadius: 12, background: "var(--surface-2)" }} />;
  }
  if (f.ext === "pdf") {
    return <iframe src={rawUrl(f)} title={f.name} style={{ width: "100%", height: "50vh", border: "none", borderRadius: 12, background: "#fff" }} />;
  }
  if (PREVIEW_TEXT.has(f.ext)) {
    return f.bytes > PREVIEW_TEXT_MAX ? <Empty>Too large to preview ({f.sizeStr})</Empty> : <TextPreview f={f} />;
  }
  return (
    <Empty>
      <Icon name={iconFor(f)} size={30} stroke={1.5} />
      <div style={{ marginTop: 8 }}>No preview for .{f.ext} files</div>
    </Empty>
  );
}

function Action({ icon, label, href, download, onClick, disabled }: {
  icon: IconName; label: string; href?: string; download?: boolean; onClick?: () => void; disabled?: boolean;
}) {
  const style = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: 12, fontSize: 13.5, fontWeight: 620,
    background: "var(--surface-2)", color: "var(--text)", opacity: disabled ? 0.5 : 1, textDecoration: "none" } as const;
  const body = <><Icon name={icon} size={16} />{label}</>;
  return href
    ? <a className="tap" href={href} download={download || undefined} target={download ? undefined : "_blank"} rel="noreferrer" style={style}>{body}</a>
    : <button className="tap" onClick={onClick} disabled={disabled} style={style}>{body}</button>;
}

function FileSheet({ f, onClose }: { f: FileItem | null; onClose: () => void }) {
  const { data: me } = useWhoami();
  const reveal = useRevealFile();
  const canOpen = !!f && (PREVIEW_IMAGE.has(f.ext) || PREVIEW_TEXT.has(f.ext) || f.ext === "pdf");
  return (
    <Sheet open={!!f} onClose={() => { reveal.reset(); onClose(); }} title={f && <span className="clip" style={{ display: "block" }}>{f.name}</span>}>
      {f && (
        <>
          <Preview f={f} />
          <div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "12px 2px 14px", wordBreak: "break-all" }}>
            {f.dir} · {f.sizeStr} · {new Date(f.modified).toLocaleString()}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canOpen && <Action icon="expand" label="Open" href={rawUrl(f)} />}
            <Action icon="download" label="Download" href={rawUrl(f, true)} download />
            {me && !me.remote && (
              <Action icon="folder" label={reveal.isSuccess ? "Revealed" : "Finder"} disabled={reveal.isPending} onClick={() => reveal.mutate(f.id)} />
            )}
          </div>
          {reveal.error && <div style={{ fontSize: 12, color: "var(--err)", marginTop: 8 }}>{reveal.error.message}</div>}
        </>
      )}
    </Sheet>
  );
}

export function Files(_: ScreenProps) {
  const { sys } = useData();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("recent");
  const [open, setOpen] = useState<FileItem | null>(null);
  const query = useDebounced(q.trim(), 250);
  const { data, isPending: loading } = useFiles(query, folder, type, sort);

  const files = data?.files || [];
  const folders = data?.folders || [];
  const diskPct = sys?.diskPct ?? 0;
  const diskUsed = sys?.diskUsedGb ?? "–";
  const diskTotal = sys?.diskTotalGb ?? "–";
  const title = query ? `Results for "${query}"` : folder ? `/${folder}` : sort === "recent" ? "Recent Files" : "Files";

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Files" sub={data ? `${data.allTotal.toLocaleString()} files · ${mbStr(data.totalMb)}` : "Workspace"} right={<ConnectionBadge />} />
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Dot color="var(--accent)" size={7} />
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>Used {diskPct}%</span>
            </div>
            {data && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Dot color="var(--cyan)" size={7} />
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>Indexed folders {mbStr(data.totalMb)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Dot color="var(--purple)" size={7} />
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>Workspace {mbStr(data.workspaceMb)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Folder pills */}
        {folders.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", marginBottom: 8 }}>FOLDERS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip active={folder === ""} onClick={() => setFolder("")}>All</Chip>
              {folders.map(f => (
                <Chip key={f.name} active={folder === f.name} onClick={() => setFolder(folder === f.name ? "" : f.name)}>
                  {f.name} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.count}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* Type pills */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", marginBottom: 8 }}>TYPE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TYPE_FILTERS.map(t => <Chip key={t.id} active={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}
          </div>
        </div>

        {/* File list */}
        <div className="between" style={{ padding: "0 4px 10px", gap: 10 }}>
          <h3 className="clip" style={{ margin: 0, fontSize: 15, fontWeight: 680, letterSpacing: -0.2 }}>{title}</h3>
          <div style={{ display: "flex", padding: 2, borderRadius: 9, background: "var(--surface-2)", flexShrink: 0 }}>
            {SORTS.map(s => (
              <button key={s.id} className="tap" onClick={() => setSort(s.id)}
                style={{ padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 620,
                  background: sort === s.id ? "var(--surface-solid)" : "transparent",
                  color: sort === s.id ? "var(--text)" : "var(--text-faint)" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card file-grid" style={{ padding: "0 14px" }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13, gridColumn: "1 / -1" }}>Loading files…</div>
          ) : files.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13, gridColumn: "1 / -1" }}>
              {query ? `No files matching "${query}"` : "No files found"}
            </div>
          ) : files.map((f, i) => <FileRow key={f.id} f={f} last={i === files.length - 1} onOpen={() => setOpen(f)} />)}
        </div>
        {data && data.total > files.length && (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12.5, color: "var(--text-ghost)" }}>
            Showing {files.length} of {data.total.toLocaleString()} files
          </div>
        )}
      </div>

      <FileSheet f={open} onClose={() => setOpen(null)} />
    </div>
  );
}
