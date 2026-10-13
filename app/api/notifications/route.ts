import { handle } from "@/lib/server/http";
import { notifications } from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ({ notifications: await notifications() }));
