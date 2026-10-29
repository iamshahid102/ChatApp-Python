import type { Metadata } from "next";

import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatScreen conversationId={id} />;
}
