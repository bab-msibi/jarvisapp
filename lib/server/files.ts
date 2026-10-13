import { promises as fsP } from "node:fs";
import os from "node:os";
import path from "node:path";

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

export interface FileEntry {
  id: string; name: string; path: string; source: string; dir: string; fullPath: string;
  ext: string; sizeStr: string; sizeKb: number; modified: number;
}

type Root = (typeof ROOTS)[number];

export async function recentFiles(params: { q?: string; folder?: string; limit?: string }) {
  const q = (params.q || "").toLowerCase();
  const folder = params.folder || "";
  const limit = Math.min(parseInt(params.limit || "") || 50, 200);
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
          sizeStr: st.size > 1048576 ? `${(st.size / 1048576).toFixed(1)} MB` : st.size > 1024 ? `${Math.round(st.size / 1024)} KB` : `${st.size} B`,
          sizeKb: Math.round(st.size / 1024),
          modified: st.mtimeMs,
        });
      } catch {}
    }
  }

  await Promise.all(ROOTS.map((r) => walk(r.dir, r, 0)));
  files.sort((a, b) => b.modified - a.modified);

  let filtered = files;
  if (folder) filtered = filtered.filter((f) => f.source === folder);
  if (q) filtered = filtered.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));

  const sourceCounts: Record<string, number> = {};
  files.forEach((f) => { sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1; });
  const folders = ROOTS.map((r) => ({ name: r.label, count: sourceCounts[r.label] || 0 })).filter((f) => f.count > 0);
  const totalBytes = files.reduce((s, f) => s + f.sizeKb * 1024, 0);

  return {
    files: filtered.slice(0, limit),
    total: filtered.length,
    allTotal: files.length,
    folders,
    workspaceMb: (totalBytes / 1048576).toFixed(0),
    workspace: HOME,
  };
}
