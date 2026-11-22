import { Suspense } from "react";
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";
import { SignInForm } from "@/app/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in | Outbound Endurance",
  description: "Sign in securely with an email verification code.",
};

type HomeProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default function Home({ searchParams }: HomeProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Outbound Endurance
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            Sign in to your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            We&apos;ll email you a one-time code. No password needed.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              aria-busy="true"
              className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground shadow-sm"
              role="status"
            >
              Loading secure sign-in...
            </div>
          }
        >
          <SignInContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function SignInContent({ searchParams }: HomeProps) {
  const { returnTo } = await searchParams;
  const returnUrl = getAllowedReturnUrl(
    typeof returnTo === "string" ? returnTo : undefined,
    env.BETTER_AUTH_URL,
  );

  return <SignInForm returnUrl={returnUrl} />;
}
