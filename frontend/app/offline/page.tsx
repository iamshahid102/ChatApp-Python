import { WifiOff } from "lucide-react";

import { LogoMark } from "@/components/brand/logo-mark";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-page p-6">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 text-center">
        <div className="flex justify-center">
          <LogoMark />
        </div>
        <div className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-surface-2">
          <WifiOff className="size-5 text-ink-soft" />
        </div>
        <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.03em]">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          Reconnect to the internet to send and receive messages. Cached chats will be
          here when you get back.
        </p>
        {/* A full reload is intentional here: client navigation needs the network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/chat"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-lime text-[14px] font-semibold text-ink transition hover:bg-lime-deep"
        >
          Try again
        </a>
      </div>
    </main>
  );
}
