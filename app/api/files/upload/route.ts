import { saveUpload } from "@/lib/server/files";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// PUT /api/files/upload?folder=<root>&name=<file name> with the raw file as the body.
// PUT (not POST) because the body isn't JSON: a cross-site PUT needs a CORS preflight we never grant
export const PUT = handle((req) => {
  const p = req.nextUrl.searchParams;
  return saveUpload(p.get("folder") || "", p.get("name") || "", req.body, Number(req.headers.get("content-length")) || 0);
});
