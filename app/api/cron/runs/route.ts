import { cronRuns } from "@/lib/server/cron";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET /api/cron/runs?id=<job id> — recent finished runs, newest first
export const GET = handle((req) => cronRuns(req.nextUrl.searchParams.get("id")));
