import { getCached } from "@/lib/server/endpoints";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(() => getCached("cron"));
