"use client";

import { Loader2, MessageCircle, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useChat } from "@/components/chat/chat-context";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages } from "@/hooks/use-messages";
import { dayKey, formatDayDivider } from "@/lib/format";
import type { ConversationSummary, UserPublic } from "@/types/api";

interface MessageListProps {
  conversation: ConversationSummary;
  currentUserId?: string;
}

export function MessageList({ conversation, currentUserId }: MessageListProps) {
  const { status } = useChat();
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMessages(conversation.id);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, users } = useMemo(() => {
    if (!data) {
      return { messages: [], users: {} as Record<string, UserPublic> };
    }
    return {
      messages: [...data.pages].reverse().flatMap((page) => page.messages),
      users: data.pages.reduce<Record<string, UserPublic>>(
        (accumulator, page) => ({ ...accumulator, ...page.users }),
        {},
      ),
    };
  }, [data]);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [lastMessageId]);

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden px-5 pb-4">
        <Skeleton className="ml-auto h-10 w-2/5 rounded-[20px] rounded-br-[6px] bg-surface-3" />
        <Skeleton className="h-16 w-3/5 rounded-[20px] rounded-bl-[6px] bg-surface-3" />
        <Skeleton className="ml-auto h-10 w-1/3 rounded-[20px] rounded-br-[6px] bg-surface-3" />
        <Skeleton className="h-12 w-1/2 rounded-[20px] rounded-bl-[6px] bg-surface-3" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[13px] text-ink-soft">Messages could not be loaded.</p>
        <Button
          variant="secondary"
          onClick={() => void refetch()}
          className="h-9 rounded-full px-4 text-[13px]"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  const rows: React.ReactNode[] = [];
  let previousDay = "";

  messages.forEach((message) => {
    const currentDay = dayKey(message.created_at);
    if (currentDay !== previousDay) {
      previousDay = currentDay;
      rows.push(
        <li key={`day-${currentDay}`} className="flex justify-center py-2">
          <span className="rounded-full px-2.5 py-1 text-[10.5px] font-medium text-ink-soft">
            {formatDayDivider(message.created_at)}
          </span>
        </li>,
      );
    }

    const own = message.sender_id === currentUserId;
    const sender = users[message.sender_id];
    rows.push(
      <MessageBubble
        key={message.id}
        message={message}
        own={own}
        isGroup={conversation.type === "group"}
        senderName={sender?.display_name ?? "Member"}
      />,
    );
  });

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-1 sm:px-6"
    >
      {status !== "open" ? (
        <div className="mb-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-medium text-white/85">
            <WifiOff className="size-3" />
            Offline — reconnecting…
          </span>
        </div>
      ) : null}

      {hasNextPage ? (
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition hover:text-ink disabled:opacity-60"
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-3 animate-spin" />
            ) : null}
            Load earlier messages
          </button>
        </div>
      ) : null}

      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-lime text-ink">
            <MessageCircle className="size-6" fill="currentColor" strokeWidth={0} />
          </div>
          <p className="mt-4 text-[16px] font-semibold">No messages yet</p>
          <p className="mt-1 max-w-[26ch] text-[12.5px] leading-relaxed text-ink-soft">
            Say hello to start the conversation.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 pb-2">{rows}</ul>
      )}
    </div>
  );
}
