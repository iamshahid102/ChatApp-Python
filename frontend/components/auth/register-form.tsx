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
  display_name: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(50, "Keep it under 50 characters"),
  username: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(24, "At most 24 characters")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only"),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const setSession = useSession((state) => state.setSession);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: "", username: "", password: "" },
  });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const data = await authApi.register({
        display_name: values.display_name.trim(),
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
      title="Create your account"
      subtitle="A username, a name and you are in."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="display_name" className="pl-1 text-[12.5px] font-medium text-ink-soft">
            Display name
          </label>
          <Input
            id="display_name"
            autoComplete="name"
            placeholder="Emily Carter"
            aria-invalid={Boolean(errors.display_name)}
            className="h-12 rounded-full border-line bg-surface-3 px-5 text-[15px] focus-visible:border-ink focus-visible:ring-ink/10"
            {...register("display_name")}
          />
          {errors.display_name ? (
            <p className="pl-1 text-[12px] text-danger">{errors.display_name.message}</p>
          ) : null}
        </div>

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
            autoComplete="new-password"
            placeholder="At least 8 characters"
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
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
