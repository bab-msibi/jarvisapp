import type { NextRequest } from "next/server";
import { getChatJob } from "@/lib/server/chat-jobs";
import { handle, HttpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(() => {
    const job = getChatJob(id);
    if (!job) throw new HttpError(404, "Chat job not found");
    return { job };
  })(req);
}
