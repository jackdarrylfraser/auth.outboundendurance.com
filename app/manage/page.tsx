import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { hasManageableStripeSubscription } from "@/lib/access/entitlement";
import { getServerSession } from "@/lib/auth/session";
import { stripeManageService } from "@/lib/billing/stripe/manage";
import { withConnection } from "@/lib/next/with-connection";
import { ManageBilling } from "@/app/account/manage-billing";
import { LogoutButton } from "@/app/account/logout-button";

export const metadata: Metadata = {
  title: "Manage subscription | Outbound Endurance",
  description: "Manage or cancel your Outbound Endurance subscription.",
};

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
            Loading your subscription...
          </p>
        </main>
      }
    >
      <ManageContent />
    </Suspense>
  );
}

const ManageContent = withConnection(async function ManageContent() {
  const session = await getServerSession();

  if (!session) {
    const loginUrl = new URL("/login", env.BASE_URL);
    loginUrl.searchParams.set(
      "returnTo",
      new URL("/manage", env.BASE_URL).href,
    );
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  if (!(await hasManageableStripeSubscription(session.user.id))) {
    redirect("/subscribe");
  }
  const billingData = await stripeManageService.getManagePageData(
    session.user.id,
  );
  if (!billingData) {
    redirect("/subscribe");
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <section
        aria-labelledby="manage-heading"
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Outbound Endurance
        </p>
        <h1
          className="mt-4 text-3xl font-semibold tracking-tight text-foreground"
          id="manage-heading"
        >
          Manage your subscription
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Update your payment method, review payment history, or cancel your
          subscription.
        </p>
        <ManageBilling data={billingData} />
        <LogoutButton />
      </section>
    </main>
  );
});
