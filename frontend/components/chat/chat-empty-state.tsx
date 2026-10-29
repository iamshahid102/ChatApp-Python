import { MessageCircle } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-card bg-surface px-8 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-ink text-lime">
        <MessageCircle className="size-7" fill="currentColor" strokeWidth={0} />
      </div>
      <h2 className="mt-5 text-[26px] font-semibold tracking-[-0.03em]">
        Pick up a conversation
      </h2>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-soft">
        Choose a chat from the list, or start a new one. Your messages stay in sync on
        every device.
      </p>
    </div>
  );
}
