import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-2xl bg-ink text-lime",
        className,
      )}
      aria-hidden="true"
    >
      <MessageCircle className="size-6" fill="currentColor" strokeWidth={0} />
    </span>
  );
}
