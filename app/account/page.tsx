import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaidAccessRequiredError } from "@/lib/entitlement-policy";
import { requirePaidAccess } from "@/lib/entitlement";
import { getServerSession } from "@/lib/session";
import { getStripeCustomerId } from "@/lib/stripe";
import { BillingPortalButton } from "./billing-portal-button";
import { PricingTable } from "./pricing-table";

export const metadata: Metadata = {
  title: "Account | Outbound Endurance",
  description: "Manage your Outbound Endurance account and subscription.",
};

export default function AccountPage() {
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
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const session = await getServerSession();

  if (!session) {
    redirect("/?returnTo=%2Faccount");
  }

  const stripeCustomerId = await getStripeCustomerId(session.user.id);

  try {
    await requirePaidAccess(session.user.id);
  } catch (error) {
    if (!(error instanceof PaidAccessRequiredError)) {
      throw error;
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
          {stripeCustomerId ? (
            <div className="mt-5">
              <BillingPortalButton />
            </div>
          ) : null}
          <div className="mt-8">
            <PricingTable />
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
          You have access to your paid membership. Manage your subscription and
          payment information through Stripe.
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
