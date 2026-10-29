"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { messagesApi } from "@/lib/api";
import { useSession } from "@/store/session";
import type { MessagePage } from "@/types/api";

export function useMessages(conversationId: string) {
  const token = useSession((state) => state.token);

  return useInfiniteQuery<MessagePage, Error>({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      messagesApi.list(token as string, conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.messages[0]?.created_at : undefined,
    enabled: Boolean(token && conversationId),
    staleTime: 5_000,
  });
}
