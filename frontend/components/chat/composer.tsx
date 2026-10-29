"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useChat } from "@/components/chat/chat-context";
import { cn } from "@/lib/utils";

export function Composer({ conversationId }: { conversationId: string }) {
  const { status, sendMessage } = useChat();
  const [value, setValue] = useState("");

  const disabled = status !== "open";
  const canSend = !disabled && value.trim().length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const clientId = sendMessage(conversationId, value);
    if (clientId) {
      setValue("");
    } else {
      toast.error("Still reconnecting. Try again in a moment.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        maxLength={2000}
        aria-label="Message"
        autoComplete="off"
        enterKeyHint="send"
        placeholder={disabled ? "Reconnecting…" : "Type a message…"}
        className={cn(
          "h-12 min-w-0 flex-1 rounded-full bg-surface-3 px-5 text-[15px] text-ink outline-none transition placeholder:text-ink-soft/70 focus-visible:ring-2 focus-visible:ring-ink/15 disabled:opacity-60",
        )}
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-ink/85 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-35"
      >
        <ArrowUp className="size-5" strokeWidth={2.4} />
      </button>
    </form>
  );
}
