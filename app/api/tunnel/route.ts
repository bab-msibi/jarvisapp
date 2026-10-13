import { invalidate } from "@/lib/server/cache";
import { getCached } from "@/lib/server/endpoints";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// ?refresh=1 re-runs the live checks instead of using the cached result
export const GET = handle((req) => {
  if (req.nextUrl.searchParams.get("refresh")) invalidate("tunnel");
  return getCached("tunnel");
});
