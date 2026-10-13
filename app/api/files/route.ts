import { cached } from "@/lib/server/cache";
import { recentFiles } from "@/lib/server/files";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle((req) => {
  const p = req.nextUrl.searchParams;
  const params = { q: p.get("q") ?? undefined, folder: p.get("folder") ?? undefined, limit: p.get("limit") ?? undefined };
  // Searches skip the cache; the unfiltered listing is cached briefly
  return p.size ? recentFiles(params) : cached("files", 30000, () => recentFiles(params));
});
