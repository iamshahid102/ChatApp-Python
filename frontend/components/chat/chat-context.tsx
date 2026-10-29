"use client";

import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { messagesApi, WS_URL } from "@/lib/api";
import { useSession } from "@/store/session";
import type { Message, MessagePage, UserPublic } from "@/types/api";

export type ConnectionStatus = "connecting" | "open" | "closed";

interface ChatContextValue {
  status: ConnectionStatus;
  onlineUserIds: Set<string>;
  sendMessage: (conversationId: string, text: string) => string | null;
  acknowledge: (conversationId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000];

interface SocketEvent {
  type: string;
  data?: Record<string, unknown>;
}

function updateMessageCache(
  queryClient: ReturnType<typeof useQueryClient>,
  message: Message,
  sender?: UserPublic,
) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    ["messages", message.conversation_id],
    (old) => {
      if (!old || old.pages.length === 0) {
        return old;
      }

      let replaced = false;
      const pages = old.pages.map((page) => ({
        ...page,
        messages: page.messages.map((existing) => {
          const sameMessage =
            existing.id === message.id ||
            (existing.client_id && existing.client_id === message.client_id);
          if (sameMessage) {
            replaced = true;
            return message;
          }
          return existing;
        }),
        users: sender ? { ...page.users, [sender.id]: sender } : page.users,
      }));

      if (replaced) {
        return { ...old, pages };
      }

      const lastPage = pages[pages.length - 1];
      pages[pages.length - 1] = {
        ...lastPage,
        messages: [...lastPage.messages, message],
        users: sender ? { ...lastPage.users, [sender.id]: sender } : lastPage.users,
      };
      return { ...old, pages };
    },
  );
}

function appendOptimisticMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  message: Message,
) {
  queryClient.setQueryData<InfiniteData<MessagePage>>(
    ["messages", message.conversation_id],
    (old) => {
      if (!old || old.pages.length === 0) {
        return old;
      }
      const pages = [...old.pages];
      const lastPage = pages[pages.length - 1];
      pages[pages.length - 1] = {
        ...lastPage,
        messages: [...lastPage.messages, message],
      };
      return { ...old, pages };
    },
  );
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const token = useSession((state) => state.token);
  const currentUser = useSession((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const activeConversationRef = useRef<string | null>(null);

  useEffect(() => {
    const match = pathname?.match(/^\/chat\/([^/]+)/);
    activeConversationRef.current = match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  useEffect(() => {
    if (!token) {
      setStatus("closed");
      return;
    }

    let disposed = false;

    const handleEvent = (event: MessageEvent<string>) => {
      let payload: SocketEvent;
      try {
        payload = JSON.parse(event.data) as SocketEvent;
      } catch {
        return;
      }

      const data = payload.data ?? {};

      switch (payload.type) {
        case "ready": {
          const ids = Array.isArray(data.online_user_ids)
            ? (data.online_user_ids as string[])
            : [];
          setOnlineUserIds(new Set(ids));
          break;
        }
        case "presence": {
          const userId = data.user_id as string | undefined;
          const online = Boolean(data.online);
          if (!userId) {
            break;
          }
          setOnlineUserIds((previous) => {
            const next = new Set(previous);
            if (online) {
              next.add(userId);
            } else {
              next.delete(userId);
            }
            return next;
          });
          break;
        }
        case "message.new": {
          const message = data.message as Message | undefined;
          const sender = data.sender as UserPublic | undefined;
          if (!message) {
            break;
          }
          updateMessageCache(queryClient, message, sender);
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });

          if (activeConversationRef.current === message.conversation_id) {
            socketRef.current?.send(
              JSON.stringify({
                type: "message.ack",
                data: { conversation_id: message.conversation_id },
              }),
            );
            void messagesApi
              .markRead(token, message.conversation_id)
              .then(() =>
                queryClient.invalidateQueries({ queryKey: ["conversations"] }),
              )
              .catch(() => undefined);
          }
          break;
        }
        case "message.sent": {
          const message = data.message as Message | undefined;
          if (!message) {
            break;
          }
          updateMessageCache(queryClient, message, currentUser ?? undefined);
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          break;
        }
        case "conversation.updated": {
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          const conversation = data.conversation as { id?: string } | undefined;
          if (conversation?.id) {
            void queryClient.invalidateQueries({
              queryKey: ["conversation", conversation.id],
            });
          }
          if (
            data.removed &&
            conversation?.id &&
            activeConversationRef.current === conversation.id
          ) {
            router.replace("/chat");
          }
          break;
        }
        case "error": {
          toast.error(
            typeof data.message === "string" ? data.message : "Message could not be sent.",
          );
          void queryClient.invalidateQueries({ queryKey: ["messages"] });
          break;
        }
        default:
          break;
      }
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      setStatus("connecting");
      const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        retryRef.current = 0;
        setStatus("open");
      };

      socket.onmessage = handleEvent;

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = (event) => {
        if (disposed) {
          return;
        }
        socketRef.current = null;
        setStatus("closed");

        if (event.code === 4401) {
          useSession.getState().clear();
          router.replace("/login");
          return;
        }

        const delay =
          RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
        retryRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [token, currentUser, queryClient, router]);

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const trimmed = text.trim();
      const socket = socketRef.current;
      const user = useSession.getState().user;

      if (!trimmed || !user || !socket || socket.readyState !== WebSocket.OPEN) {
        return null;
      }

      const clientId = crypto.randomUUID();
      const optimistic: Message = {
        id: `pending-${clientId}`,
        conversation_id: conversationId,
        sender_id: user.id,
        text: trimmed,
        client_id: clientId,
        created_at: new Date().toISOString(),
        pending: true,
      };

      appendOptimisticMessage(queryClient, optimistic);
      socket.send(
        JSON.stringify({
          type: "message.send",
          data: { conversation_id: conversationId, text: trimmed, client_id: clientId },
        }),
      );

      return clientId;
    },
    [queryClient],
  );

  const acknowledge = useCallback(
    (conversationId: string) => {
      socketRef.current?.send(
        JSON.stringify({
          type: "message.ack",
          data: { conversation_id: conversationId },
        }),
      );

      const activeToken = useSession.getState().token;
      if (!activeToken) {
        return;
      }

      void messagesApi
        .markRead(activeToken, conversationId)
        .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => undefined);
    },
    [queryClient],
  );

  const value = useMemo(
    () => ({ status, onlineUserIds, sendMessage, acknowledge }),
    [status, onlineUserIds, sendMessage, acknowledge],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used inside ChatProvider");
  }
  return context;
}
