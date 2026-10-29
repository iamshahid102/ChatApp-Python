"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

interface ThemeToggleProps {
  /** Overrides for the trigger, e.g. to sit on a lime or chrome surface. */
  className?: string;
  align?: "start" | "center" | "end";
}

export function ThemeToggle({ className, align = "end" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change theme"
        title="Change theme"
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition hover:bg-hover focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none",
          className,
        )}
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className="min-w-[184px] rounded-2xl p-1.5"
      >
        <p className="px-2.5 py-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-soft uppercase">
          Appearance
        </p>
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={(value) => setTheme(value as string)}
        >
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                closeOnClick
                className="gap-2.5 rounded-xl py-2 pr-8 pl-2.5 text-[13px] font-medium focus:bg-surface-2 focus:text-ink"
              >
                <Icon className="size-4" />
                <span className="flex-1">{option.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
