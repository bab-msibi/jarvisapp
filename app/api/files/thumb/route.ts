import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { thumbnail } from "@/lib/server/files";

export const dynamic = "force-dynamic";

// GET /api/files/thumb?id=<file id>&m=<mtime> — m only busts the browser cache when the file changes
export async function GET(req: NextRequest) {
  try {
    const out = await thumbnail(req.nextUrl.searchParams.get("id") || "");
    return new NextResponse(Readable.toWeb(fs.createReadStream(out)) as ReadableStream, {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=604800", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message || "Internal error" }, { status: err.status || 500 });
  }
}
