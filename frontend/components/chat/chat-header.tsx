"use client";

import { ChevronLeft, Info } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/chat/user-avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  conversationSubtitle,
  conversationTitle,
  otherMember,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types/api";

interface ChatHeaderProps {
  conversation: ConversationSummary;
  currentUserId?: string;
  onlineUserIds: Set<string>;
  onInfo: () => void;
  mobile?: boolean;
}

export function ChatHeader({
  conversation,
  currentUserId,
  onlineUserIds,
  onInfo,
  mobile = false,
}: ChatHeaderProps) {
  const title = conversationTitle(conversation, currentUserId);
  const subtitle = conversationSubtitle(conversation, currentUserId, onlineUserIds);
  const other = otherMember(conversation, currentUserId);
  const online = Boolean(other && onlineUserIds.has(other.id));
  const reference = conversation.id.slice(-5).toUpperCase();

  if (mobile) {
    return (
      <header className="flex items-center gap-3 rounded-card bg-lime p-3">
        <Link
          href="/chat"
          aria-label="Back to chats"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-chrome text-ink transition hover:bg-chrome-strong focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <UserAvatar
          name={title}
          color={conversation.type === "group" ? "#0D0D0D" : (other?.avatar_color ?? "#C7F032")}
          isGroup={conversation.type === "group"}
          size="md"
          className={conversation.type === "group" ? "text-lime" : undefined}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[21px] leading-tight font-semibold tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink/60">
            {conversation.type === "direct" ? (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  online ? "bg-[#4f8f00]" : "bg-ink/30",
                )}
              />
            ) : null}
            {subtitle} · #{reference}
          </p>
        </div>
        <button
          type="button"
          onClick={onInfo}
          aria-label="Conversation details"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-chrome text-ink transition hover:bg-chrome-strong focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
        >
          <Info className="size-4" />
        </button>
      </header>
    );
  }

  return (
    <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 lg:px-8 lg:pt-7">
      <div className="min-w-0">
        <h1 className="truncate text-[30px] leading-tight font-semibold tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-soft">
          {conversation.type === "direct" ? (
            <span
              className={cn(
                "size-1.5 rounded-full",
                online ? "bg-online" : "bg-ink-soft/35",
              )}
            />
          ) : null}
          {subtitle}
          <span className="text-ink-soft/60">· #{reference}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={onInfo}
          aria-label="Conversation details"
          className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink transition hover:bg-hover focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
        >
          <Info className="size-4" />
        </button>
      </div>
    </header>
  );
}
