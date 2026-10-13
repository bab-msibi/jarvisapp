import { getCached } from "@/lib/server/endpoints";
import { history } from "@/lib/server/history";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ({ ...(await getCached("system")), history: history() }));
