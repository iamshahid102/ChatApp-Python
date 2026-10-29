import type { Metadata } from "next";

import { ChatEmptyState } from "@/components/chat/chat-empty-state";

export const metadata: Metadata = {
  title: "Chats",
};

export default function ChatIndexPage() {
  return <ChatEmptyState />;
}
