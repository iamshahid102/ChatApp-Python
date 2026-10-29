import { clearApiCache } from "@/lib/pwa";
import { useSession } from "@/store/session";
import type {
  AuthResponse,
  ConversationSummary,
  Message,
  MessagePage,
  UserPublic,
} from "@/types/api";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  `${API_BASE.replace(/^http/, "ws").replace(/\/api\/v1$/, "")}/ws`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await response.json()) as {
        detail?: string | { msg?: string }[];
      };
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        message = data.detail[0].msg;
      }
    } catch {
      // Keep the fallback message.
    }

    if (response.status === 401 && token) {
      useSession.getState().clear();
      void clearApiCache();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const authApi = {
  register: (body: { username: string; display_name: string; password: string }) =>
    api<AuthResponse>("/auth/register", { method: "POST", body }),
  login: (body: { username: string; password: string }) =>
    api<AuthResponse>("/auth/login", { method: "POST", body }),
  me: (token: string) => api<UserPublic>("/auth/me", { token }),
  logout: (token: string) => api<void>("/auth/logout", { method: "POST", token }),
};

export const usersApi = {
  search: (token: string, query: string) =>
    api<UserPublic[]>(`/users?q=${encodeURIComponent(query)}&limit=20`, { token }),
};

export const conversationsApi = {
  list: (token: string) => api<ConversationSummary[]>("/conversations", { token }),
  get: (token: string, id: string) =>
    api<ConversationSummary>(`/conversations/${encodeURIComponent(id)}`, { token }),
  createDirect: (token: string, userId: string) =>
    api<ConversationSummary>("/conversations/direct", {
      method: "POST",
      body: { user_id: userId },
      token,
    }),
  createGroup: (token: string, name: string, memberIds: string[]) =>
    api<ConversationSummary>("/conversations/group", {
      method: "POST",
      body: { name, member_ids: memberIds },
      token,
    }),
  addMembers: (token: string, id: string, memberIds: string[]) =>
    api<ConversationSummary>(`/conversations/${encodeURIComponent(id)}/members`, {
      method: "POST",
      body: { member_ids: memberIds },
      token,
    }),
  removeMember: (token: string, id: string, userId: string) =>
    api<void>(
      `/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE", token },
    ),
};

export const messagesApi = {
  list: (token: string, conversationId: string, before?: string) => {
    const params = new URLSearchParams({ limit: "30" });
    if (before) {
      params.set("before", before);
    }
    return api<MessagePage>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
      { token },
    );
  },
  send: (token: string, conversationId: string, text: string, clientId: string) =>
    api<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: { text, client_id: clientId },
      token,
    }),
  markRead: (token: string, conversationId: string) =>
    api<void>(`/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: "POST",
      token,
    }),
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
