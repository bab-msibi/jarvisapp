import { handle } from "@/lib/server/http";
import { installDesktopMcp } from "@/lib/server/mcp";

export const dynamic = "force-dynamic";

export const POST = handle(installDesktopMcp);
