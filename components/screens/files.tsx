"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Bar, Dot, Header, Icon, Sheet, type IconName } from "@/components/ui/primitives";
import { relTime } from "@/lib/api";
import { PREVIEW_IMAGE, PREVIEW_TEXT, PREVIEW_TEXT_MAX } from "@/lib/file-types";
import type { ScreenProps } from "@/lib/nav";
import { useData, useFiles, useRevealFile, useWhoami } from "@/lib/queries";
import type { FileItem, FilesResponse } from "@/lib/types";

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
const fmtBytes = (b: number) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.round(b / 1048576)} MB`);
const THUMB_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic", "pdf", "mp4", "mov", "m4v"]);
const thumbUrl = (f: FileItem) =>
  f.ext === "svg" ? rawUrl(f) : THUMB_EXT.has(f.ext) ? `/api/files/thumb?id=${encodeURIComponent(f.id)}&m=${Math.round(f.modified)}` : null;
const FOLDER_COLOR: Record<string, string> = {
  Desktop: "var(--accent)", Downloads: "var(--warn)", Documents: "var(--ok)", Pictures: "var(--purple)", Workspace: "var(--cyan)",
};
const UPLOAD_FOLDERS = ["Workspace", "Downloads", "Desktop", "Documents"];

// "Today", "Yesterday", "This week", "This month", then "Month Year"
function dayBucket(ms: number) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const day = 86400000;
  if (ms >= start.getTime()) return "Today";
  if (ms >= start.getTime() - day) return "Yesterday";
  if (ms >= start.getTime() - 6 * day) return "This week";
  if (ms >= new Date(start.getFullYear(), start.getMonth(), 1).getTime()) return "This month";
  return new Date(ms).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
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

function FileThumb({ f, color }: { f: FileItem; color: string }) {
  const src = thumbUrl(f);
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color, overflow: "hidden" }}>
      {src && !failed
        ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <Icon name={iconFor(f)} size={17} stroke={1.8} />}
    </div>
  );
}

function FileRow({ f, last, onOpen }: { f: FileItem; last: boolean; onOpen: () => void }) {
  const color = EXT_COLOR[f.ext] || "var(--text-faint)";
  return (
    <button className="tap" onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", width: "100%", minWidth: 0, textAlign: "left",
      borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <FileThumb key={f.id} f={f} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clip" style={{ fontSize: 13.5, fontWeight: 600 }}>{f.name}</div>
        <div className="clip" style={{ fontSize: 11.5, color: "var(--text-ghost)", marginTop: 2 }}>
          <span className="mono" style={{ fontSize: 10.5, color, background: `color-mix(in oklab, ${color} 12%, transparent)`, padding: "1px 5px", borderRadius: 4, marginRight: 6 }}>{f.ext.toUpperCase()}</span>
          {f.contentMatch && <span style={{ color: "var(--accent)", fontWeight: 600, marginRight: 6 }}>in contents ·</span>}
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


function DiskCard({ data, onOpen }: { data?: FilesResponse; onOpen: (f: FileItem) => void }) {
  const { sys } = useData();
  const diskPct = sys?.diskPct ?? 0;
  return (
    <div className="card" style={{ padding: 15, marginBottom: 16 }}>
      <div className="between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 620 }}>Mac Disk</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{sys?.diskUsedGb ?? "–"} / {sys?.diskTotalGb ?? "–"} GB · {diskPct}%</span>
      </div>
      <Bar value={diskPct} color="var(--accent)" h={7} />

      {data && data.totalBytes > 0 && (
        <>
          <div className="between" style={{ margin: "14px 0 8px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)" }}>INDEXED FOLDERS</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{fmtBytes(data.totalBytes)}</span>
          </div>
          <div style={{ display: "flex", height: 7, borderRadius: 7, overflow: "hidden", background: "var(--surface-2)", gap: 2 }}>
            {data.folders.map(f => (
              <div key={f.name} title={`${f.name} ${fmtBytes(f.bytes)}`}
                style={{ width: `${(f.bytes / data.totalBytes) * 100}%`, minWidth: f.bytes ? 3 : 0, background: FOLDER_COLOR[f.name] || "var(--text-faint)" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10 }}>
            {data.folders.map(f => (
              <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color={FOLDER_COLOR[f.name] || "var(--text-faint)"} size={7} />
                <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 540 }}>{f.name} {fmtBytes(f.bytes)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {data && data.cleanup.count > 0 && (
        <>
          <div style={{ margin: "16px 0 4px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)" }}>CLEANUP CANDIDATES</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>
            {data.cleanup.count} download{data.cleanup.count === 1 ? "" : "s"} over 50 MB, untouched for 30+ days · {fmtBytes(data.cleanup.bytes)}
          </div>
          {data.cleanup.files.map((f, i) => <FileRow key={f.id} f={f} last={i === data.cleanup.files.length - 1} onOpen={() => onOpen(f)} />)}
        </>
      )}
    </div>
  );
}

interface UploadJob { id: number; name: string; progress: number; status: "uploading" | "done" | "error"; error?: string }

function uploadFile(folder: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/files/upload?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(file.name)}`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let msg = `HTTP ${xhr.status}`;
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

export function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("Workspace");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const busy = jobs.some(j => j.status === "uploading");
  const update = (id: number, patch: Partial<UploadJob>) => setJobs(js => js.map(j => (j.id === id ? { ...j, ...patch } : j)));

  async function start(list: FileList | null) {
    if (!list?.length) return;
    const picked = [...list].map((file, i) => ({ file, job: { id: Date.now() + i, name: file.name, progress: 0, status: "uploading" as const } }));
    setJobs(js => [...picked.map(p => p.job), ...js]);
    for (const { file, job } of picked) {
      if (file.size > 100 * 1048576) { update(job.id, { status: "error", error: "Larger than 100 MB" }); continue; }
      try {
        await uploadFile(folder, file, progress => update(job.id, { progress }));
        update(job.id, { status: "done", progress: 1 });
      } catch (e) {
        update(job.id, { status: "error", error: (e as Error).message });
      }
    }
    qc.invalidateQueries({ queryKey: ["files"] });
  }

  return (
    <Sheet open={open} onClose={() => { if (!busy) { setJobs([]); onClose(); } }} title="Upload files">
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", marginBottom: 8 }}>SAVE TO</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {UPLOAD_FOLDERS.map(f => <Chip key={f} active={folder === f} onClick={() => setFolder(f)}>{f}</Chip>)}
      </div>
      <input ref={input} type="file" multiple hidden onChange={e => { start(e.target.files); e.target.value = ""; }} />
      <Action icon="upload" label="Choose files" onClick={() => input.current?.click()} />
      <div style={{ fontSize: 11.5, color: "var(--text-ghost)", margin: "8px 2px 0" }}>Up to 100 MB each. Existing files are never overwritten.</div>
      {jobs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {jobs.map((j, i) => (
            <div key={j.id} style={{ padding: "9px 0", borderBottom: i === jobs.length - 1 ? "none" : "1px solid var(--border)" }}>
              <div className="between" style={{ gap: 10, marginBottom: j.status === "uploading" ? 6 : 0 }}>
                <span className="clip" style={{ fontSize: 13, fontWeight: 600 }}>{j.name}</span>
                <span style={{ fontSize: 12, flexShrink: 0, color: j.status === "error" ? "var(--err)" : j.status === "done" ? "var(--ok)" : "var(--text-faint)" }}>
                  {j.status === "error" ? j.error : j.status === "done" ? "Saved" : `${Math.round(j.progress * 100)}%`}
                </span>
              </div>
              {j.status === "uploading" && <Bar value={j.progress * 100} color="var(--accent)" h={4} />}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function FileGroup({ title, files, onOpen }: { title?: string; files: FileItem[]; onOpen: (f: FileItem) => void }) {
  return (
    <>
      {title && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-ghost)", margin: "4px 4px 8px" }}>{title.toUpperCase()}</div>}
      <div className="card file-grid" style={{ padding: "0 14px", marginBottom: 14 }}>
        {files.map((f, i) => <FileRow key={f.id} f={f} last={i === files.length - 1} onOpen={() => onOpen(f)} />)}
      </div>
    </>
  );
}

export function Files(_: ScreenProps) {
  const [q, setQ] = useState("");
  const [content, setContent] = useState(false);
  const [folder, setFolder] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("recent");
  const [open, setOpen] = useState<FileItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const query = useDebounced(q.trim(), 250);
  const { data: pages, isPending: loading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } = useFiles(query, folder, type, sort, content);
  const sentinel = useRef<HTMLDivElement>(null);

  const data = pages?.pages[0];
  const files = pages?.pages.flatMap(p => p.files) || [];
  const folders = data?.folders || [];
  const title = query ? `Results for "${query}"` : folder ? `/${folder}` : sort === "recent" ? "Recent Files" : "Files";
  const searchingContents = content && query.length >= 3 && isFetching && !isFetchingNextPage;

  // Load the next page as the end of the list scrolls into view
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && !isFetchingNextPage && fetchNextPage(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Day headings only make sense when the list is in date order
  const groups: { title?: string; files: FileItem[] }[] = [];
  if (sort === "recent") {
    for (const f of files) {
      const t = dayBucket(f.modified);
      if (groups.at(-1)?.title === t) groups.at(-1)!.files.push(f);
      else groups.push({ title: t, files: [f] });
    }
  } else if (files.length) groups.push({ files });

  return (
    <div className="screen pad-b anim-screen">
      <Header title="Files" sub={data ? `${data.allTotal.toLocaleString()} files · ${fmtBytes(data.totalBytes)}` : "Workspace"} right={<ConnectionBadge />} />
      <OfflineBanner pageName="Files" />

      {/* Search + upload */}
      <div style={{ padding: "0 18px 14px", display: "flex", gap: 8 }}>
        <div className="glass" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, padding: "0 8px 0 14px", height: 44, borderRadius: 13 }}>
          <Icon name="search" size={17} style={{ color: "var(--text-faint)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={content ? "Search names and contents…" : "Search files…"}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5, fontFamily: "inherit" }} />
          {q && <button className="tap" onClick={() => setQ("")} style={{ color: "var(--text-ghost)", padding: 4 }}><Icon name="x" size={15} /></button>}
          <button className="tap" onClick={() => setContent(c => !c)} title="Also search inside files"
            style={{ flexShrink: 0, padding: "5px 9px", borderRadius: 8, fontSize: 11.5, fontWeight: 650,
              background: content ? "var(--accent)" : "var(--surface-2)", color: content ? "#fff" : "var(--text-faint)" }}>
            Contents
          </button>
        </div>
        <button className="tap glass" onClick={() => setUploading(true)} title="Upload files"
          style={{ width: 44, height: 44, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", flexShrink: 0 }}>
          <Icon name="upload" size={18} />
        </button>
      </div>

      <div className="pad">
        {!query && <DiskCard data={data} onOpen={setOpen} />}

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
        {content && query.length > 0 && query.length < 3 && (
          <div style={{ fontSize: 12, color: "var(--text-ghost)", margin: "-4px 4px 10px" }}>Type 3+ characters to search inside files</div>
        )}
        {searchingContents && <div style={{ fontSize: 12, color: "var(--text-ghost)", margin: "-4px 4px 10px" }}>Searching contents…</div>}

        {loading ? (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>Loading files…</div>
        ) : files.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-ghost)", fontSize: 13 }}>
            {query ? `No files matching "${query}"` : "No files found"}
          </div>
        ) : groups.map((g, i) => <FileGroup key={g.title || i} title={g.title} files={g.files} onOpen={setOpen} />)}

        {data && files.length > 0 && (
          <div ref={sentinel} style={{ textAlign: "center", marginTop: 4, fontSize: 12.5, color: "var(--text-ghost)" }}>
            {hasNextPage ? (
              <button className="tap" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                style={{ padding: "8px 16px", borderRadius: 10, background: "var(--surface-2)", color: "var(--text-dim)", fontSize: 12.5, fontWeight: 620 }}>
                {isFetchingNextPage ? "Loading…" : `Load more · ${files.length} of ${data.total.toLocaleString()}`}
              </button>
            ) : data.total > 60 && `All ${data.total.toLocaleString()} files shown`}
          </div>
        )}
      </div>

      <FileSheet f={open} onClose={() => setOpen(null)} />
      <UploadSheet open={uploading} onClose={() => setUploading(false)} />
    </div>
  );
}
