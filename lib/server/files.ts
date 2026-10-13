import { promises as fsP } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileType, type FileType } from "@/lib/file-types";
import { cached } from "@/lib/server/cache";
import { HttpError } from "@/lib/server/http";

const HOME = os.homedir();
// The agent workspace plus the user's common folders, so "Recent Files"
// reflects real activity (screenshots, downloads, docs)
const ROOTS = [
  { label: "Desktop", dir: path.join(HOME, "Desktop"), depth: 3 },
  { label: "Downloads", dir: path.join(HOME, "Downloads"), depth: 3 },
  { label: "Documents", dir: path.join(HOME, "Documents"), depth: 3 },
  { label: "Pictures", dir: path.join(HOME, "Pictures"), depth: 3 },
  { label: "Workspace", dir: path.join(HOME, ".openclaw", "workspace"), depth: 6 },
];
const IGNORE = new Set([".git", ".obsidian", ".DS_Store", "node_modules", ".tmp", "Photos Library.photoslibrary"]);
const SORTS = ["recent", "size", "name"] as const;
type Sort = (typeof SORTS)[number];

export interface FileEntry {
  id: string; name: string; path: string; source: string; dir: string; fullPath: string;
  ext: string; type: FileType | null; sizeStr: string; bytes: number; modified: number;
}

type Root = (typeof ROOTS)[number];

function sizeStr(bytes: number) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : bytes > 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

async function scan(): Promise<FileEntry[]> {
  const files: FileEntry[] = [];

  async function walk(dir: string, root: Root, depth: number): Promise<void> {
    if (depth > root.depth) return;
    let entries;
    try { entries = await fsP.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full, root, depth + 1);
        continue;
      }
      try {
        const st = await fsP.stat(full);
        const rel = path.relative(root.dir, full);
        const sub = path.dirname(rel);
        const ext = path.extname(e.name).replace(".", "").toLowerCase();
        files.push({
          id: `${root.label}/${rel}`,
          name: e.name,
          path: sub === "." ? e.name : rel,
          source: root.label,
          dir: sub === "." ? root.label : `${root.label}/${sub}`,
          fullPath: full,
          ext: ext || "file",
          type: fileType(ext),
          sizeStr: sizeStr(st.size),
          bytes: st.size,
          modified: st.mtimeMs,
        });
      } catch {}
    }
  }

  await Promise.all(ROOTS.map((r) => walk(r.dir, r, 0)));
  return files.sort((a, b) => b.modified - a.modified);
}

// One disk walk serves every search, filter and sort for 30s
const scanCached = () => cached("files:scan", 30000, scan);

export async function recentFiles(params: { q?: string; folder?: string; type?: string; sort?: string; limit?: string }) {
  const q = (params.q || "").toLowerCase();
  const folder = params.folder || "";
  const type = params.type || "";
  const sort: Sort = SORTS.includes(params.sort as Sort) ? (params.sort as Sort) : "recent";
  const limit = Math.min(parseInt(params.limit || "") || 50, 200);
  const files = await scanCached();

  let filtered = files;
  if (folder) filtered = filtered.filter((f) => f.source === folder);
  if (type) filtered = filtered.filter((f) => f.type === type);
  if (q) filtered = filtered.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  if (sort === "size") filtered = [...filtered].sort((a, b) => b.bytes - a.bytes);
  if (sort === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const sourceCounts: Record<string, number> = {};
  const sourceBytes: Record<string, number> = {};
  files.forEach((f) => {
    sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1;
    sourceBytes[f.source] = (sourceBytes[f.source] || 0) + f.bytes;
  });
  const folders = ROOTS.map((r) => ({ name: r.label, count: sourceCounts[r.label] || 0 })).filter((f) => f.count > 0);
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);

  return {
    files: filtered.slice(0, limit),
    total: filtered.length,
    allTotal: files.length,
    folders,
    totalMb: (totalBytes / 1048576).toFixed(0),
    workspaceMb: ((sourceBytes.Workspace || 0) / 1048576).toFixed(0),
    workspace: HOME,
  };
}

// Maps a file id ("<root label>/<relative path>") to a real path, refusing anything that
// resolves outside its root — this backs a download endpoint reachable over the tunnel
export async function resolveFile(id: string) {
  const slash = id.indexOf("/");
  const root = ROOTS.find((r) => r.label === id.slice(0, slash));
  const rel = id.slice(slash + 1);
  if (slash < 1 || !root || !rel) throw new HttpError(400, "Invalid file id");
  if (rel.split(/[\\/]/).some((seg) => seg.startsWith(".") || IGNORE.has(seg))) throw new HttpError(403, "Not allowed");

  let real: string, rootReal: string;
  try {
    [real, rootReal] = await Promise.all([fsP.realpath(path.resolve(root.dir, rel)), fsP.realpath(root.dir)]);
  } catch {
    throw new HttpError(404, "File not found");
  }
  if (!real.startsWith(rootReal + path.sep)) throw new HttpError(403, "Not allowed");
  const st = await fsP.stat(real);
  if (!st.isFile()) throw new HttpError(404, "File not found");
  return { fullPath: real, name: path.basename(real), ext: path.extname(real).replace(".", "").toLowerCase(), size: st.size };
}
