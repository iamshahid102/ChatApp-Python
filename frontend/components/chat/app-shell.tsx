"use client";

import { usePathname } from "next/navigation";

import { ConversationList } from "@/components/chat/conversation-list";
import { ProfileCard } from "@/components/chat/profile-card";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatOpen = Boolean(pathname && /^\/chat\/[^/]+/.test(pathname));

  return (
    <div className="h-dvh overflow-hidden bg-page p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex h-full max-w-[1440px] gap-3 lg:gap-4">
        <aside
          className={cn(
            "h-full min-h-0 w-full shrink-0 flex-col gap-3 lg:flex lg:w-[335px] xl:w-[365px]",
            chatOpen ? "hidden" : "flex",
          )}
        >
          <ProfileCard />
          <ConversationList />
        </aside>

        <main
          className={cn(
            "h-full min-h-0 min-w-0 flex-1",
            chatOpen ? "block" : "hidden lg:block",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
