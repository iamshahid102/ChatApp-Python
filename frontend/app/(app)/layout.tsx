"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppShell } from "@/components/chat/app-shell";
import { ChatProvider } from "@/components/chat/chat-context";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/store/session";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = useSession((state) => state.token);
  const hydrated = useHydrated();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page">
        <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[13px] font-medium text-ink-soft">
          <Loader2 className="size-4 animate-spin" />
          Loading chats
        </div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
    </ChatProvider>
  );
}
