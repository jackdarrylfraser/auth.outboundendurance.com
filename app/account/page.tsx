import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";
import { getServerSession } from "@/lib/auth/session";
import { getStripeCustomerId } from "@/lib/billing/stripe/client";
import { BillingPortalButton } from "@/app/account/billing-portal-button";
import { PricingOptions } from "@/app/account/pricing-options";

export const metadata: Metadata = {
  title: "Account | Outbound Endurance",
  description: "Manage your Outbound Endurance account and subscription.",
};

type AccountPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default function AccountPage({ searchParams }: AccountPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p aria-live="polite" className="text-sm text-zinc-600" role="status">
            Loading your account...
          </p>
        </main>
      }
    >
      <AccountContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountContent({ searchParams }: AccountPageProps) {
  await connection();

  const requestedReturnTo = (await searchParams).returnTo;
  const validatedReturnTo = getAllowedReturnUrl(
    typeof requestedReturnTo === "string" ? requestedReturnTo : undefined,
    env.BETTER_AUTH_URL,
  );
  const returnTo =
    validatedReturnTo &&
    new URL(validatedReturnTo).pathname !== "/account"
      ? validatedReturnTo
      : null;
  const session = await getServerSession();

  if (!session) {
    const loginUrl = new URL("/login", env.BETTER_AUTH_URL);
    loginUrl.searchParams.set(
      "returnTo",
      returnTo ?? new URL("/account", env.BETTER_AUTH_URL).href,
    );
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const stripeCustomerId = await getStripeCustomerId(session.user.id);

  try {
    await requirePaidAccess(session.user.id);
    if (returnTo) {
      redirect(returnTo);
    }
  } catch (error) {
    if (!(error instanceof PaidAccessRequiredError)) {
      throw error;
    }

    if (
      returnTo &&
      new URL(returnTo).pathname === "/billing/return" &&
      new URL(returnTo).origin === new URL(env.BETTER_AUTH_URL).origin
    ) {
      redirect(returnTo);
    }

    return (
      <main className="flex flex-1 justify-center px-6 py-16">
        <section className="w-full max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Outbound Endurance
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
            Choose your plan
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Select a plan below to continue. Checkout is securely hosted by
            Stripe.
          </p>
          <div className="mt-8">
            <PricingOptions returnTo={returnTo} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section
        aria-labelledby="account-heading"
        className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Outbound Endurance
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950"
          id="account-heading"
        >
          Your plan is active
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          You have access to your paid membership. If you cancel, your access
          continues through the end of your paid period. Manage or cancel your
          subscription through Stripe.
        </p>
        {stripeCustomerId ? (
          <div className="mt-6">
            <BillingPortalButton />
          </div>
        ) : null}
      </section>
    </main>
  );
}
