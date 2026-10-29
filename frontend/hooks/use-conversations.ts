"use client";

import { useQuery } from "@tanstack/react-query";

import { conversationsApi } from "@/lib/api";
import { useSession } from "@/store/session";

export function useConversations() {
  const token = useSession((state) => state.token);

  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => conversationsApi.list(token as string),
    enabled: Boolean(token),
    staleTime: 10_000,
  });
}

export function useConversation(conversationId: string | undefined) {
  const token = useSession((state) => state.token);

  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationsApi.get(token as string, conversationId as string),
    enabled: Boolean(token && conversationId),
    staleTime: 10_000,
  });
}
