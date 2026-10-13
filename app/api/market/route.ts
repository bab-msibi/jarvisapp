import { handle } from "@/lib/server/http";
import { marketData } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export const GET = handle(marketData);
