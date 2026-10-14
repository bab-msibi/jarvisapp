import type { NextRequest } from "next/server";
import { stopChatJob } from "@/lib/server/chat-jobs";
import { handle, HttpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// POST: stop a reply that's still being generated
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(() => {
    const job = stopChatJob(id);
    if (!job) throw new HttpError(404, "Chat job not found");
    return { job };
  })(req);
}
