import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { avatarTextColor, initials } from "@/lib/format";

const SIZES = {
  sm: { box: "size-9", text: "text-[11px]", icon: "size-4" },
  md: { box: "size-11", text: "text-[13px]", icon: "size-5" },
  lg: { box: "size-14", text: "text-base", icon: "size-6" },
};

interface UserAvatarProps {
  name: string;
  color?: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  isGroup?: boolean;
  className?: string;
}

export function UserAvatar({
  name,
  color = "#C7F032",
  size = "md",
  online = false,
  isGroup = false,
  className,
}: UserAvatarProps) {
  const styles = SIZES[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", styles.box, className)}
      style={{ backgroundColor: color, color: avatarTextColor(color) }}
      aria-hidden="true"
    >
      {isGroup ? (
        <Users className={styles.icon} strokeWidth={2.2} />
      ) : (
        <span className={cn("font-semibold tracking-tight", styles.text)}>{initials(name)}</span>
      )}
      {online ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-online" />
      ) : null}
    </span>
  );
}
