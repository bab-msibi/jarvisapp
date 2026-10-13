import { handle } from "@/lib/server/http";
import { mcpStatus } from "@/lib/server/mcp";

export const dynamic = "force-dynamic";

export const GET = handle(mcpStatus);
