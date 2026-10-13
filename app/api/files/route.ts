import { recentFiles } from "@/lib/server/files";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// The disk walk is cached inside recentFiles, so searches and filters are in-memory
export const GET = handle((req) => {
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k) ?? undefined;
  return recentFiles({ q: get("q"), folder: get("folder"), type: get("type"), sort: get("sort"), limit: get("limit"), offset: get("offset"), content: get("content") });
});
