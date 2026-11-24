import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import {
  hasManageableStripeSubscription,
  requirePaidAccess,
} from "@/lib/access/entitlement";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";
import { getServerSession } from "@/lib/auth/session";
import { withConnection } from "@/lib/next/with-connection";
import { LogoutButton } from "@/app/account/logout-button";
import { PricingOptions } from "@/app/account/pricing-options";

export const metadata: Metadata = {
  title: "Subscribe | Outbound Endurance",
  description: "Choose an Outbound Endurance subscription plan.",
};

type SubscribePageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default function SubscribePage({
  searchParams,
}: SubscribePageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            Loading subscription options...
          </p>
        </main>
      }
    >
      <SubscribeContent searchParams={searchParams} />
    </Suspense>
  );
}

const SubscribeContent = withConnection(async function SubscribeContent({
  searchParams,
}: SubscribePageProps) {
  const requestedReturnTo = (await searchParams).returnTo;
  const validatedReturnTo = getAllowedReturnUrl(
    typeof requestedReturnTo === "string" ? requestedReturnTo : undefined,
    env.BETTER_AUTH_URL,
  );
  const returnTo =
    validatedReturnTo &&
    !["/account", "/subscribe"].includes(
      new URL(validatedReturnTo).pathname,
    )
      ? validatedReturnTo
      : null;
  const session = await getServerSession();

  if (!session) {
    const loginUrl = new URL("/login", env.BETTER_AUTH_URL);
    loginUrl.searchParams.set(
      "returnTo",
      returnTo ?? new URL("/subscribe", env.BETTER_AUTH_URL).href,
    );
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const showManageSubscription = await hasManageableStripeSubscription(
    session.user.id,
  );

  try {
    await requirePaidAccess(session.user.id);
    if (returnTo) {
      redirect(returnTo);
    }
    if (showManageSubscription) {
      redirect("/manage");
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

    if (showManageSubscription) {
      redirect("/manage");
    }
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section className="w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Outbound Endurance
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Choose your plan
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Select a plan below to continue. Checkout is securely hosted by Stripe.
        </p>
        <div className="mt-8">
          <PricingOptions returnTo={returnTo} />
        </div>
        <LogoutButton />
      </section>
    </main>
  );
});
