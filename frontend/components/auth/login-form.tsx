"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, authApi } from "@/lib/api";
import { clearApiCache } from "@/lib/pwa";
import { useSession } from "@/store/session";

const schema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const setSession = useSession((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const data = await authApi.login({
        username: values.username.trim(),
        password: values.password,
      });
      await clearApiCache();
      setSession(data.token, data.user);
      router.replace("/chat");
    } catch (error) {
      setFormError(apiErrorMessage(error));
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <span>
          New here?{" "}
          <Link href="/register" className="font-semibold text-ink underline underline-offset-4">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="username" className="pl-1 text-[12.5px] font-medium text-ink-soft">
            Username
          </label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="emily"
            aria-invalid={Boolean(errors.username)}
            className="h-12 rounded-full border-line bg-surface-3 px-5 text-[15px] focus-visible:border-ink focus-visible:ring-ink/10"
            {...register("username")}
          />
          {errors.username ? (
            <p className="pl-1 text-[12px] text-danger">{errors.username.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="pl-1 text-[12.5px] font-medium text-ink-soft">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            className="h-12 rounded-full border-line bg-surface-3 px-5 text-[15px] focus-visible:border-ink focus-visible:ring-ink/10"
            {...register("password")}
          />
          {errors.password ? (
            <p className="pl-1 text-[12px] text-danger">{errors.password.message}</p>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-2xl bg-danger/10 px-4 py-3 text-[13px] text-danger"
          >
            {formError}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-full bg-lime text-[15px] font-semibold text-ink hover:bg-lime-deep"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
