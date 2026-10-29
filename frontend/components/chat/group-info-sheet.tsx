"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUsers } from "@/hooks/use-users";
import { apiErrorMessage, conversationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import type { ConversationSummary } from "@/types/api";

interface GroupInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationSummary;
  currentUserId?: string;
  onlineUserIds: Set<string>;
}

export function GroupInfoSheet({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onlineUserIds,
}: GroupInfoSheetProps) {
  const token = useSession((state) => state.token);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const isGroup = conversation.type === "group";
  const isOwner = Boolean(currentUserId && conversation.owner_id === currentUserId);
  const { data: searchResults } = useUsers(query, open && isGroup && isOwner);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["conversation", conversation.id] });
  };

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      conversationsApi.addMembers(token as string, conversation.id, [userId]),
    onSuccess: () => {
      setQuery("");
      invalidate();
      toast.success("Member added");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      conversationsApi.removeMember(token as string, conversation.id, userId),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const leaveMutation = useMutation({
    mutationFn: () =>
      conversationsApi.removeMember(token as string, conversation.id, currentUserId as string),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      router.replace("/chat");
      toast.success(isGroup ? "You left the group" : "Chat removed");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const memberIds = new Set(conversation.members.map((member) => member.id));
  const addable = (searchResults ?? []).filter((user) => !memberIds.has(user.id));
  const title = isGroup ? (conversation.name ?? "Group chat") : "Chat details";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-card border-0 bg-surface p-0 sm:mx-auto sm:max-w-lg sm:rounded-card"
      >
        <SheetHeader className="p-6 pb-3">
          <SheetTitle className="text-[24px] font-semibold tracking-[-0.03em]">
            {title}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-ink-soft">
            {isGroup
              ? `${conversation.members.length} ${
                  conversation.members.length === 1 ? "member" : "members"
                }`
              : "You are chatting directly with this person."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
          <section>
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
              Members
            </h3>
            <ul className="mt-2 divide-y divide-line/60">
              {conversation.members.map((member) => {
                const isMe = member.id === currentUserId;
                const online = isGroup
                  ? false
                  : onlineUserIds.has(member.id);
                return (
                  <li key={member.id} className="flex items-center gap-3 py-3">
                    <UserAvatar
                      name={member.display_name}
                      color={member.avatar_color}
                      size="sm"
                      online={online}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14px] font-semibold">
                        {member.display_name}
                        {isMe ? (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[12px] text-ink-soft">
                        @{member.username}
                      </p>
                    </div>
                    {conversation.owner_id === member.id ? (
                      <span className="rounded-full bg-lime px-2.5 py-1 text-[10px] font-semibold text-ink">
                        Owner
                      </span>
                    ) : null}
                    {isOwner && isGroup && !isMe ? (
                      <button
                        type="button"
                        aria-label={`Remove ${member.display_name}`}
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(member.id)}
                        className="grid size-8 place-items-center rounded-full text-ink-soft transition hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {isGroup && isOwner ? (
            <section>
              <h3 className="text-[11px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
                Add people
              </h3>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or username"
                  className="h-11 rounded-full border-line bg-surface-3 pr-4 pl-10 text-[14px] focus-visible:border-ink focus-visible:ring-ink/10"
                />
              </div>

              <div className="mt-2 space-y-1">
                {addable.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2"
                  >
                    <UserAvatar
                      name={user.display_name}
                      color={user.avatar_color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">
                        {user.display_name}
                      </p>
                      <p className="truncate text-[11.5px] text-ink-soft">
                        @{user.username}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Add ${user.display_name}`}
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate(user.id)}
                      className="grid size-8 place-items-center rounded-full bg-ink text-on-ink transition hover:bg-ink/85 disabled:opacity-50"
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                    </button>
                  </div>
                ))}

                {addable.length === 0 ? (
                  <p className="px-2 py-2 text-[12px] text-ink-soft">
                    {query ? "No matching people." : "Everyone is already here."}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {isGroup ? (
            <Button
              type="button"
              variant="secondary"
              disabled={leaveMutation.isPending}
              onClick={() => leaveMutation.mutate()}
              className={cn(
                "h-11 w-full rounded-full bg-danger/10 text-[13.5px] font-semibold text-danger hover:bg-danger/15",
              )}
            >
              {leaveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              Leave group
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
