import { Suspense } from "react";
import { env } from "@/lib/env";
import { getAllowedReturnUrl } from "@/lib/return-url";
import { SignInForm } from "./sign-in-form";

type HomeProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default function Home({ searchParams }: HomeProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Outbound Endurance
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
            Sign in to your account
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            We&apos;ll email you a one-time code. No password needed.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              aria-busy="true"
              className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 shadow-sm"
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
