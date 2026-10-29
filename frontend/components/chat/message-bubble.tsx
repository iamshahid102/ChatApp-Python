import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/api";

interface MessageBubbleProps {
  message: Message;
  own: boolean;
  isGroup: boolean;
  senderName: string;
}

export function MessageBubble({ message, own, isGroup, senderName }: MessageBubbleProps) {
  return (
    <li className={cn("flex w-full flex-col", own ? "items-end" : "items-start")}>
      {isGroup && !own ? (
        <span className="mb-1 pl-2 text-[11.5px] font-medium text-ink-soft">
          {senderName}
        </span>
      ) : null}

      <div
        className={cn(
          "max-w-[82%] rounded-[20px] px-4 py-2.5 text-[15px] leading-[1.45] break-words whitespace-pre-wrap sm:max-w-[76%]",
          own
            ? "rounded-br-[6px] bg-ink text-on-ink"
            : "rounded-bl-[6px] bg-surface-3 text-ink",
          message.pending && "opacity-60",
        )}
      >
        {message.text}
      </div>

      <span
        className="mt-1 px-2 text-[10.5px] text-ink-soft/80"
        title={new Date(message.created_at).toLocaleString()}
      >
        {message.pending ? "Sending…" : formatTime(message.created_at)}
      </span>
    </li>
  );
}
