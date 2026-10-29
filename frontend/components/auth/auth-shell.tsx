import { LogoMark } from "@/components/brand/logo-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-page p-4 sm:p-6">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle className="size-10 bg-surface text-ink hover:bg-hover" />
      </div>
      <div className="w-full max-w-[920px] overflow-hidden rounded-[28px] bg-surface shadow-[0_1px_0_var(--hairline)] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden flex-col justify-between bg-lime p-10 lg:flex">
          <LogoMark />
          <div>
            <h2 className="max-w-[9ch] text-[44px] font-semibold leading-[0.98] tracking-[-0.04em]">
              Simple chats. Everywhere.
            </h2>
            <p className="mt-5 max-w-[28ch] text-[14px] leading-relaxed text-ink/70">
              One-to-one and group conversations. Install it on your phone, your desktop,
              or just use it in the browser.
            </p>
          </div>
          <p className="text-[11.5px] font-medium tracking-wide text-ink/55">
            CHATAPP · V1
          </p>
        </aside>

        <section className="px-6 py-10 sm:px-10 lg:px-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-10" />
            <div>
              <p className="text-[17px] font-semibold tracking-tight">ChatApp</p>
              <p className="text-[12px] text-ink-soft">Simple chat, installed anywhere.</p>
            </div>
          </div>

          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <div className="mt-7 text-[13px] text-ink-soft">{footer}</div>
        </section>
      </div>
    </main>
  );
}
