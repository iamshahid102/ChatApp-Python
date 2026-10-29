"use client";

import { Download, MoreVertical, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setInstructionsOpen(false);
      toast.success("ChatApp installed");
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) {
    return null;
  }

  if (!deferredPrompt && !isIos) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setInstructionsOpen(true);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white/75 text-[13px] font-semibold text-ink transition hover:bg-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
      >
        <Download className="size-4" />
        Install app
      </button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="rounded-card bg-surface sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[21px] font-semibold tracking-tight">
              Install on iPhone or iPad
            </DialogTitle>
            <DialogDescription className="text-[13.5px] text-ink-soft">
              Safari does not offer a one-tap install button. Add ChatApp to your home
              screen instead.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-[14px]">
            <li className="flex items-center gap-3 rounded-2xl bg-surface-3 px-4 py-3">
              <Share className="size-4 shrink-0" />
              <span>Tap the Share button in Safari&apos;s toolbar.</span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-surface-3 px-4 py-3">
              <SquarePlus className="size-4 shrink-0" />
              <span>Choose &ldquo;Add to Home Screen&rdquo;.</span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-surface-3 px-4 py-3">
              <MoreVertical className="size-4 shrink-0" />
              <span>Tap &ldquo;Add&rdquo;. ChatApp opens full screen from your home screen.</span>
            </li>
          </ol>

          <Button
            onClick={() => setInstructionsOpen(false)}
            className="h-11 w-full rounded-full bg-lime font-semibold text-ink hover:bg-lime-deep"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
