import { busyAgents } from "@/lib/server/chat-jobs";
import { getCached } from "@/lib/server/endpoints";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// `busy` is live (not cached): agents with a chat reply in progress
export const GET = handle(async () => ({ ...(await getCached("agents")), busy: busyAgents() }));
