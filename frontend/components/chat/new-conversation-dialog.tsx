"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers } from "@/hooks/use-users";
import { apiErrorMessage, conversationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import type { ConversationSummary, UserPublic } from "@/types/api";

type Mode = "direct" | "group";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: Mode;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  initialMode = "direct",
}: NewConversationDialogProps) {
  const token = useSession((state) => state.token);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<UserPublic[]>([]);

  const { data: users, isLoading } = useUsers(query, open);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setQuery("");
      setGroupName("");
      setSelected([]);
    }
  }, [open, initialMode]);

  const handleCreated = (conversation: ConversationSummary) => {
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    onOpenChange(false);
    router.push(`/chat/${conversation.id}`);
  };

  const directMutation = useMutation({
    mutationFn: (userId: string) => conversationsApi.createDirect(token as string, userId),
    onSuccess: handleCreated,
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const groupMutation = useMutation({
    mutationFn: () =>
      conversationsApi.createGroup(
        token as string,
        groupName.trim(),
        selected.map((user) => user.id),
      ),
    onSuccess: handleCreated,
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const toggleSelected = (user: UserPublic) => {
    setSelected((previous) =>
      previous.some((item) => item.id === user.id)
        ? previous.filter((item) => item.id !== user.id)
        : [...previous, user],
    );
  };

  const canCreateGroup =
    groupName.trim().length > 0 && selected.length > 0 && !groupMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card bg-surface p-0 sm:max-w-md">
        <div className="p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[23px] font-semibold tracking-[-0.02em]">
              New conversation
            </DialogTitle>
            <DialogDescription className="text-[13px] text-ink-soft">
              Pick someone to chat with, or bring a few people together.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 flex gap-2">
            {(["direct", "group"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={cn(
                  "h-9 rounded-full px-4 text-[13px] font-semibold transition",
                  mode === item
                    ? "bg-ink text-on-ink"
                    : "bg-surface-2 text-ink-soft hover:text-ink",
                )}
              >
                {item === "direct" ? "One-to-one" : "Group"}
              </button>
            ))}
          </div>

          {mode === "group" ? (
            <div className="mt-4 space-y-4">
              <Input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name"
                maxLength={60}
                className="h-11 rounded-full border-line bg-surface-3 px-4 text-[14px] focus-visible:border-ink focus-visible:ring-ink/10"
              />

              {selected.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-lime py-1 pr-1.5 pl-3 text-[12px] font-semibold"
                    >
                      {user.display_name}
                      <button
                        type="button"
                        aria-label={`Remove ${user.display_name}`}
                        onClick={() => toggleSelected(user)}
                        className="grid size-5 place-items-center rounded-full bg-chrome hover:bg-chrome-strong"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-soft" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              className="h-11 rounded-full border-line bg-surface-3 pr-4 pl-10 text-[14px] focus-visible:border-ink focus-visible:ring-ink/10"
            />
          </div>

          <div className="mt-3 max-h-[280px] space-y-1.5 overflow-y-auto no-scrollbar">
            {isLoading ? (
              [0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))
            ) : users && users.length > 0 ? (
              users.map((user) => {
                const isSelected = selected.some((item) => item.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={directMutation.isPending}
                    onClick={() =>
                      mode === "direct"
                        ? directMutation.mutate(user.id)
                        : toggleSelected(user)
                    }
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-surface-2 disabled:opacity-60"
                  >
                    <UserAvatar
                      name={user.display_name}
                      color={user.avatar_color}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {user.display_name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-soft">
                        @{user.username}
                      </span>
                    </span>
                    {mode === "group" ? (
                      <span
                        className={cn(
                          "grid size-6 place-items-center rounded-full border",
                          isSelected
                            ? "border-ink bg-ink text-lime"
                            : "border-line text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    ) : directMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin text-ink-soft" />
                    ) : (
                      <Plus className="size-4 text-ink-soft" />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-[13px] text-ink-soft">
                No people found.
              </p>
            )}
          </div>

          {mode === "group" ? (
            <Button
              type="button"
              onClick={() => groupMutation.mutate()}
              disabled={!canCreateGroup}
              className="mt-4 h-11 w-full rounded-full bg-lime font-semibold text-ink hover:bg-lime-deep disabled:opacity-40"
            >
              {groupMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create group
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
