import { chatMessages, listAppChats } from "@/lib/server/chat-history";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// GET ?agentId=main → app chats with previews; ?agentId=main&chat=jarvisapp-… → that chat's messages
export const GET = handle((req) => {
  const p = req.nextUrl.searchParams;
  const agentId = p.get("agentId") || "";
  const chat = p.get("chat");
  return chat ? chatMessages(agentId, chat) : listAppChats(agentId);
});
