import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs, { promises as fsP } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileType, PREVIEW_TEXT, type FileType } from "@/lib/file-types";
import { cached, invalidate } from "@/lib/server/cache";
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
  contentMatch?: boolean;
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

const run = (cmd: string, args: string[], timeout = 8000) =>
  new Promise<string>((resolve, reject) =>
    execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, out) => (err ? reject(err) : resolve(out))));

// Full paths whose contents match q. Spotlight covers the normal folders (including PDFs and
// Office files); it doesn't index the hidden workspace, so its text files are read directly
async function contentMatches(q: string, files: FileEntry[]): Promise<Set<string>> {
  const spotlight = ROOTS.filter((r) => r.label !== "Workspace").flatMap((r) => ["-onlyin", r.dir]);
  const found = new Set<string>();
  const viaSpotlight = run("mdfind", [...spotlight, q.replace(/^-+/, "")])
    .then((out) => out.split("\n").forEach((p) => p && found.add(p)))
    .catch(() => {});
  const workspaceText = files.filter((f) => f.source === "Workspace" && PREVIEW_TEXT.has(f.ext) && f.bytes < 1048576);
  const viaRead = Promise.all(workspaceText.map(async (f) => {
    try {
      if ((await fsP.readFile(f.fullPath, "utf8")).toLowerCase().includes(q)) found.add(f.fullPath);
    } catch {}
  }));
  await Promise.all([viaSpotlight, viaRead]);
  return found;
}

const CLEANUP_MIN_BYTES = 50 * 1048576;
const CLEANUP_MIN_AGE = 30 * 86400000;

export async function recentFiles(params: {
  q?: string; folder?: string; type?: string; sort?: string; limit?: string; offset?: string; content?: string;
}) {
  const q = (params.q || "").trim().toLowerCase();
  const folder = params.folder || "";
  const type = params.type || "";
  const sort: Sort = SORTS.includes(params.sort as Sort) ? (params.sort as Sort) : "recent";
  const limit = Math.min(parseInt(params.limit || "") || 50, 200);
  const offset = Math.max(parseInt(params.offset || "") || 0, 0);
  const files = await scanCached();

  let filtered = files;
  if (folder) filtered = filtered.filter((f) => f.source === folder);
  if (type) filtered = filtered.filter((f) => f.type === type);
  if (q) {
    const inContent = params.content === "1" && q.length >= 3 ? await contentMatches(q, filtered) : new Set<string>();
    filtered = filtered.flatMap((f) => {
      if (f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) return [f];
      return inContent.has(f.fullPath) ? [{ ...f, contentMatch: true }] : [];
    });
  }
  if (sort === "size") filtered = [...filtered].sort((a, b) => b.bytes - a.bytes);
  if (sort === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const sourceCounts: Record<string, number> = {};
  const sourceBytes: Record<string, number> = {};
  files.forEach((f) => {
    sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1;
    sourceBytes[f.source] = (sourceBytes[f.source] || 0) + f.bytes;
  });
  const folders = ROOTS.map((r) => ({ name: r.label, count: sourceCounts[r.label] || 0, bytes: sourceBytes[r.label] || 0 })).filter((f) => f.count > 0);
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  // Big, old downloads are the usual dead weight
  const now = Date.now();
  const cleanup = files
    .filter((f) => f.source === "Downloads" && f.bytes >= CLEANUP_MIN_BYTES && now - f.modified >= CLEANUP_MIN_AGE)
    .sort((a, b) => b.bytes - a.bytes);

  return {
    files: filtered.slice(offset, offset + limit),
    offset,
    total: filtered.length,
    allTotal: files.length,
    folders,
    totalBytes,
    totalMb: (totalBytes / 1048576).toFixed(0),
    workspaceMb: ((sourceBytes.Workspace || 0) / 1048576).toFixed(0),
    cleanup: { files: cleanup.slice(0, 5), count: cleanup.length, bytes: cleanup.reduce((s, f) => s + f.bytes, 0) },
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

// Small JPEG thumbnails, cached on disk by path + mtime. sips handles images; Quick Look covers PDFs and video
const THUMB_DIR = path.join(HOME, "Library", "Caches", "ai.jarvis", "thumbs");
const THUMB_SIZE = 160;
const SIPS_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);
const QL_EXT = new Set(["pdf", "mp4", "mov", "m4v"]);
let thumbSlots = 2;
const thumbQueue: (() => void)[] = [];

async function withThumbSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (thumbSlots === 0) await new Promise<void>((r) => thumbQueue.push(r));
  else thumbSlots--;
  try { return await fn(); } finally {
    const next = thumbQueue.shift();
    if (next) next(); else thumbSlots++;
  }
}

export async function thumbnail(id: string): Promise<string> {
  const file = await resolveFile(id);
  if (!SIPS_EXT.has(file.ext) && !QL_EXT.has(file.ext)) throw new HttpError(415, "No thumbnail for this type");
  const st = await fsP.stat(file.fullPath);
  const key = crypto.createHash("sha1").update(`${file.fullPath}:${st.mtimeMs}:${THUMB_SIZE}`).digest("hex");
  const out = path.join(THUMB_DIR, `${key}.jpg`);
  try { await fsP.access(out); return out; } catch {}

  await fsP.mkdir(THUMB_DIR, { recursive: true });
  return withThumbSlot(async () => {
    try {
      if (SIPS_EXT.has(file.ext)) {
        await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", String(THUMB_SIZE * 2), file.fullPath, "--out", out], 15000);
      } else {
        // qlmanage names its output after the source file, so give each job its own folder
        const tmp = await fsP.mkdtemp(path.join(THUMB_DIR, "ql-"));
        try {
          await run("qlmanage", ["-t", "-s", String(THUMB_SIZE * 2), "-o", tmp, file.fullPath], 15000);
          const [png] = (await fsP.readdir(tmp)).filter((n) => n.endsWith(".png"));
          if (!png) throw new Error("no thumbnail");
          await run("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", path.join(tmp, png), "--out", out], 15000);
        } finally {
          await fsP.rm(tmp, { recursive: true, force: true });
        }
      }
    } catch {
      throw new HttpError(422, "Couldn't make a thumbnail");
    }
    return out;
  });
}

// Uploads land at the top of a root; existing files are never overwritten
export const UPLOAD_FOLDERS = ["Workspace", "Downloads", "Desktop", "Documents"];
export const UPLOAD_MAX = 100 * 1048576;

export async function saveUpload(folder: string, rawName: string, body: ReadableStream<Uint8Array> | null, declared: number) {
  const root = ROOTS.find((r) => r.label === folder);
  if (!root || !UPLOAD_FOLDERS.includes(folder)) throw new HttpError(400, "Can't upload there");
  const name = path.basename(rawName.replace(/\\/g, "/")).replace(/[\x00-\x1f]/g, "").trim();
  if (!name || name.startsWith(".") || IGNORE.has(name)) throw new HttpError(400, "Invalid file name");
  if (!body) throw new HttpError(400, "Empty upload");
  if (declared > UPLOAD_MAX) throw new HttpError(413, "File is larger than 100 MB");

  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let written = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      written += chunk.length;
      cb(written > UPLOAD_MAX ? new HttpError(413, "File is larger than 100 MB") : null, chunk);
    },
  });

  for (let n = 0; n < 100; n++) {
    const target = path.join(root.dir, n ? `${stem} (${n})${ext}` : name);
    let handle;
    try {
      handle = await fsP.open(target, "wx");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw e;
    }
    try {
      await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, fs.createWriteStream("", { fd: handle.fd, autoClose: false }));
    } catch (e) {
      await handle.close();
      await fsP.rm(target, { force: true });
      throw e;
    }
    await handle.close();
    invalidate("files:scan");
    const rel = path.relative(root.dir, target);
    return { id: `${root.label}/${rel}`, name: path.basename(target), bytes: written };
  }
  throw new HttpError(409, "Too many files with that name");
}
