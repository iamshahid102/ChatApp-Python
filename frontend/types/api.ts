export interface UserPublic {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  last_seen_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export type ConversationType = "direct" | "group";

export interface LastMessage {
  text: string;
  sender_id: string;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  name: string | null;
  owner_id: string | null;
  members: UserPublic[];
  last_message: LastMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  client_id: string;
  created_at: string;
  pending?: boolean;
}

export interface MessagePage {
  messages: Message[];
  users: Record<string, UserPublic>;
  has_more: boolean;
}

export interface ReadyEvent {
  user_id: string;
  online_user_ids: string[];
}
