import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_TEXT } from "@/lib/file-types";
import { resolveFile } from "@/lib/server/files";

export const dynamic = "force-dynamic";

// Only these are ever served inline; everything else is a download
const INLINE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  pdf: "application/pdf",
};

// GET /api/files/raw?id=<file id>[&download=1]
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const download = req.nextUrl.searchParams.has("download");
  let file;
  try {
    file = await resolveFile(id);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message || "Internal error" }, { status: err.status || 500 });
  }

  // Text (including .html and .js) is always plain text so it can't run as a page on this origin
  const mime = INLINE_MIME[file.ext] || (PREVIEW_TEXT.has(file.ext) ? "text/plain; charset=utf-8" : null);
  const inline = !download && !!mime;
  const headers: Record<string, string> = {
    "Content-Type": inline ? mime! : "application/octet-stream",
    "Content-Length": String(file.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  // Opaque origin for anything opened directly (e.g. an SVG with script); Chrome refuses to render sandboxed PDFs
  if (file.ext !== "pdf") headers["Content-Security-Policy"] = "sandbox";

  const body = Readable.toWeb(fs.createReadStream(file.fullPath)) as ReadableStream;
  return new NextResponse(body, { headers });
}
