"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InstallPrompt } from "@/components/pwa/install-prompt";
import { UserAvatar } from "@/components/chat/user-avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authApi } from "@/lib/api";
import { clearApiCache } from "@/lib/pwa";
import { useSession } from "@/store/session";

export function ProfileCard() {
  const user = useSession((state) => state.user);
  const token = useSession((state) => state.token);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!token || loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await authApi.logout(token);
    } catch {
      // Logging out locally is enough even if the request fails.
    }
    useSession.getState().clear();
    queryClient.clear();
    await clearApiCache();
    router.replace("/login");
  };

  const name = user?.display_name ?? "Your profile";

  return (
    <div className="shrink-0 rounded-card bg-lime p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <UserAvatar
          name={name}
          color="#0D0D0D"
          size="md"
          className="text-lime"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16.5px] font-semibold leading-tight tracking-[-0.02em]">
            {name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink/60">
            <span className="size-1.5 rounded-full bg-ink/50" />
            @{user?.username ?? "you"}
          </p>
        </div>
        <ThemeToggle className="bg-chrome hover:bg-chrome-strong" />
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-chrome text-ink transition hover:bg-chrome-strong focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none disabled:opacity-60"
        >
          {loggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
        </button>
      </div>

      <InstallPrompt />
    </div>
  );
}
