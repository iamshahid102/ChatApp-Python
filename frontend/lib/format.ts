import type { ConversationSummary, UserPublic } from "@/types/api";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarTextColor(background: string): string {
  const hex = background.replace("#", "");
  if (hex.length !== 6) {
    return "#0D0D0D";
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0D0D0D" : "#F7F7F3";
}

export function otherMember(
  conversation: ConversationSummary,
  currentUserId: string | undefined,
): UserPublic | null {
  if (conversation.type !== "direct" || !currentUserId) {
    return null;
  }
  return (
    conversation.members.find((member) => member.id !== currentUserId) ??
    conversation.members[0] ??
    null
  );
}

export function conversationTitle(
  conversation: ConversationSummary,
  currentUserId: string | undefined,
): string {
  if (conversation.type === "group") {
    return conversation.name?.trim() || "Group chat";
  }
  return otherMember(conversation, currentUserId)?.display_name ?? "Direct chat";
}

export function conversationSubtitle(
  conversation: ConversationSummary,
  currentUserId: string | undefined,
  onlineUserIds: Set<string>,
): string {
  if (conversation.type === "group") {
    const count = conversation.members.length;
    return `${count} ${count === 1 ? "member" : "members"}`;
  }
  const other = otherMember(conversation, currentUserId);
  if (!other) {
    return "Direct chat";
  }
  return onlineUserIds.has(other.id) ? "online" : "offline";
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${time}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
