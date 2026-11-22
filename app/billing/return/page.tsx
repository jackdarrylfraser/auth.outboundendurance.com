import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getServerSession } from "@/lib/auth/session";
import { BillingReturnStatus } from "@/app/billing/return/billing-return-status";

export const metadata: Metadata = {
  title: "Billing status | Outbound Endurance",
  description: "Check the status of your subscription checkout.",
};

type BillingReturnPageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

export default async function BillingReturnPage({
  searchParams,
}: BillingReturnPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p aria-live="polite" className="text-sm text-zinc-600" role="status">
            Loading your subscription status...
          </p>
        </main>
      }
    >
      <BillingReturnContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BillingReturnContent({
  searchParams,
}: BillingReturnPageProps) {
  const { session_id: sessionIdParam } = await searchParams;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : null;

  if (!sessionId?.startsWith("cs_")) {
    redirect("/account");
  }

  const session = await getServerSession();

  if (!session) {
    const returnUrl = new URL("/billing/return", env.BETTER_AUTH_URL);
    returnUrl.searchParams.set("session_id", sessionId);
    const loginUrl = new URL("/login", env.BETTER_AUTH_URL);
    loginUrl.searchParams.set("returnTo", returnUrl.href);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section
        aria-labelledby="billing-return-heading"
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Outbound Endurance
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950"
          id="billing-return-heading"
        >
          Checking your subscription
        </h1>
        <BillingReturnStatus sessionId={sessionId} />
      </section>
    </main>
  );
}
