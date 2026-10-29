"use client";

import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useChat } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/hooks/use-conversations";
import { conversationTitle, formatTime, otherMember } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";

export function ConversationList() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const user = useSession((state) => state.user);
  const pathname = usePathname();
  const { onlineUserIds } = useChat();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<"direct" | "group">("direct");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("new");
    if (requested !== "chat" && requested !== "group") {
      return;
    }

    setInitialMode(requested === "group" ? "group" : "direct");
    setDialogOpen(true);

    params.delete("new");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  const openDialog = (mode: "direct" | "group") => {
    setInitialMode(mode);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-card bg-surface p-3 sm:p-4">
        <div className="flex items-center justify-between px-1.5 pb-3">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Chats</h2>
          <button
            type="button"
            onClick={() => openDialog("direct")}
            aria-label="Start a new conversation"
            className="grid size-9 place-items-center rounded-full bg-ink text-white transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex h-[60px] items-center gap-3 rounded-full bg-surface-2/70 px-3"
                >
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] text-ink-soft">
                Could not load your chats.
              </p>
              <Button
                variant="secondary"
                onClick={() => void refetch()}
                className="h-9 rounded-full px-4 text-[13px]"
              >
                <RefreshCw className="size-3.5" />
                Try again
              </Button>
            </div>
          ) : conversations && conversations.length > 0 ? (
            conversations.map((conversation) => {
              const active = pathname === `/chat/${conversation.id}`;
              const other = otherMember(conversation, user?.id);
              const title = conversationTitle(conversation, user?.id);
              const preview = conversation.last_message
                ? `${conversation.last_message.sender_id === user?.id ? "You: " : ""}${conversation.last_message.text}`
                : "No messages yet";

              return (
                <Link
                  key={conversation.id}
                  href={`/chat/${conversation.id}`}
                  className={cn(
                    "flex min-h-[60px] items-center gap-3 rounded-[999px] px-3 py-2 transition",
                    active
                      ? "bg-ink text-white"
                      : "bg-surface-2 text-ink hover:bg-[#dcded7]",
                  )}
                >
                  <UserAvatar
                    name={title}
                    color={
                      conversation.type === "group"
                        ? "#C7F032"
                        : (other?.avatar_color ?? "#C7F032")
                    }
                    isGroup={conversation.type === "group"}
                    online={
                      conversation.type === "direct" && other
                        ? onlineUserIds.has(other.id)
                        : false
                    }
                    size="sm"
                    className={active ? "ring-0" : undefined}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                        {title}
                      </span>
                      {conversation.last_message ? (
                        <span
                          className={cn(
                            "shrink-0 text-[10.5px]",
                            active ? "text-white/50" : "text-ink-soft",
                          )}
                        >
                          {formatTime(conversation.last_message.created_at)}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-[12px]",
                        active ? "text-white/55" : "text-ink-soft",
                      )}
                    >
                      {preview}
                    </span>
                  </span>
                  {conversation.unread_count > 0 ? (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime text-[10px] font-bold text-ink">
                      {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                    </span>
                  ) : null}
                </Link>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-surface-2">
                <Plus className="size-5 text-ink-soft" />
              </div>
              <p className="mt-3 text-[14px] font-semibold">No chats yet</p>
              <p className="mt-1 max-w-[24ch] text-[12.5px] leading-relaxed text-ink-soft">
                Start a one-to-one chat or create a group.
              </p>
              <Button
                onClick={() => openDialog("direct")}
                className="mt-4 h-9 rounded-full bg-lime px-4 text-[13px] font-semibold text-ink hover:bg-lime-deep"
              >
                Start chatting
              </Button>
            </div>
          )}
        </div>

        <div className="px-1.5 pt-3">
          <button
            type="button"
            onClick={() => openDialog("group")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-surface-2 text-[12.5px] font-semibold text-ink-soft transition hover:text-ink"
          >
            <Plus className="size-3.5" />
            New group
          </button>
        </div>
      </div>

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialMode={initialMode}
      />
    </>
  );
}
