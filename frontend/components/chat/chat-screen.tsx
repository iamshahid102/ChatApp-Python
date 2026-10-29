"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useChat } from "@/components/chat/chat-context";
import { ChatHeader } from "@/components/chat/chat-header";
import { Composer } from "@/components/chat/composer";
import { GroupInfoSheet } from "@/components/chat/group-info-sheet";
import { MessageList } from "@/components/chat/message-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversation } from "@/hooks/use-conversations";
import { useSession } from "@/store/session";

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const user = useSession((state) => state.user);
  const { acknowledge, onlineUserIds } = useChat();
  const { data: conversation, isLoading, isError, refetch } = useConversation(conversationId);
  const [infoOpen, setInfoOpen] = useState(false);

  const resolvedId = conversation?.id;

  useEffect(() => {
    if (resolvedId) {
      acknowledge(resolvedId);
    }
  }, [resolvedId, acknowledge]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Skeleton className="h-[72px] rounded-card bg-lime/40 lg:hidden" />
        <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface p-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="mt-2 h-3 w-24" />
          <div className="mt-auto space-y-3 pb-4">
            <Skeleton className="ml-auto h-12 w-2/5 rounded-bubble rounded-br-[6px] bg-surface-3" />
            <Skeleton className="h-16 w-3/5 rounded-bubble rounded-bl-[6px] bg-surface-3" />
            <Skeleton className="ml-auto h-10 w-1/3 rounded-bubble rounded-br-[6px] bg-surface-3" />
          </div>
          <Skeleton className="h-12 w-full rounded-full bg-surface-3" />
        </div>
      </div>
    );
  }

  if (isError || !conversation) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-card bg-surface px-6 text-center">
        <p className="text-[17px] font-semibold">This conversation is unavailable.</p>
        <p className="mt-1 max-w-[32ch] text-[13px] text-ink-soft">
          It may have been removed, or you no longer have access to it.
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => void refetch()}
            className="h-10 rounded-full px-4 text-[13px]"
          >
            <Loader2 className="size-3.5" />
            Retry
          </Button>
          <Link
            href="/chat"
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-on-ink"
          >
            Back to chats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="lg:hidden">
          <ChatHeader
            mobile
            conversation={conversation}
            currentUserId={user?.id}
            onlineUserIds={onlineUserIds}
            onInfo={() => setInfoOpen(true)}
          />
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-surface">
          <div className="hidden lg:block">
            <ChatHeader
              conversation={conversation}
              currentUserId={user?.id}
              onlineUserIds={onlineUserIds}
              onInfo={() => setInfoOpen(true)}
            />
          </div>

          <MessageList conversation={conversation} currentUserId={user?.id} />
          <Composer conversationId={conversation.id} />
        </section>
      </div>

      <GroupInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        conversation={conversation}
        currentUserId={user?.id}
        onlineUserIds={onlineUserIds}
      />
    </>
  );
}
