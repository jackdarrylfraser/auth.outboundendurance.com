import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getServerSession } from "@/lib/auth/session";
import { withConnection } from "@/lib/next/with-connection";
import { BillingReturnStatus } from "@/app/billing/return/billing-return-status";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";

export const metadata: Metadata = {
  title: "Billing status | Outbound Endurance",
  description: "Check the status of your subscription payment.",
};

type BillingReturnPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function BillingReturnPage({
  searchParams,
}: BillingReturnPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            Loading your subscription status...
          </p>
        </main>
      }
    >
      <BillingReturnContent searchParams={searchParams} />
    </Suspense>
  );
}

const BillingReturnContent = withConnection(async function BillingReturnContent({
  searchParams,
}: BillingReturnPageProps) {
  const { returnTo: returnToParam } = await searchParams;
  const returnTo = getAllowedReturnUrl(
    typeof returnToParam === "string" ? returnToParam : undefined,
    env.BASE_URL,
  );
  const session = await getServerSession();

  if (!session) {
    const returnUrl = new URL("/billing/return", env.BASE_URL);
    if (returnTo) {
      returnUrl.searchParams.set("returnTo", returnTo);
    }
    const loginUrl = new URL("/login", env.BASE_URL);
    loginUrl.searchParams.set("returnTo", returnUrl.href);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section
        aria-labelledby="billing-return-heading"
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Outbound Endurance
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-foreground"
          id="billing-return-heading"
        >
          Checking your subscription
        </h1>
        <BillingReturnStatus returnTo={returnTo} />
      </section>
    </main>
  );
});
