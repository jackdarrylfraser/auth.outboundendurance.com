import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getServerSession } from "@/lib/auth/session";
import { stripeManageService } from "@/lib/billing/stripe/manage";
import { withConnection } from "@/lib/next/with-connection";
import { ManageCancellation } from "@/app/account/manage-cancellation";
import { LogoutButton } from "@/app/account/logout-button";

export const metadata: Metadata = {
  title: "Cancel or resume subscription | Outbound Endurance",
  description: "Manage cancellation or resumption of your subscription.",
};

export default function ManageCancellationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 justify-center px-6 py-16">
          <p
            aria-live="polite"
            className="text-sm text-muted-foreground"
            role="status"
          >
            Loading your subscription...
          </p>
        </main>
      }
    >
      <ManageCancellationContent />
    </Suspense>
  );
}

const ManageCancellationContent = withConnection(
  async function ManageCancellationContent() {
    const session = await getServerSession();

    if (!session) {
      const loginUrl = new URL("/login", env.BASE_URL);
      loginUrl.searchParams.set(
        "returnTo",
        new URL("/manage/cancel", env.BASE_URL).href,
      );
      redirect(`${loginUrl.pathname}${loginUrl.search}`);
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
          aria-labelledby="manage-cancellation-heading"
          className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Outbound Endurance
          </p>
          <h1
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground"
            id="manage-cancellation-heading"
          >
            Cancel or resume your subscription
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Manage whether your subscription continues after the current
            billing period.
          </p>
          <ManageCancellation
            data={billingData}
            key={[
              billingData.subscription.status,
              billingData.subscription.cancelAtPeriodEnd,
              billingData.subscription.cancelAt,
              billingData.subscription.currentPeriodEnd,
            ].join(":")}
          />
          <Link
            className="mt-6 inline-flex text-sm font-semibold text-primary underline underline-offset-4"
            href="/manage"
          >
            Back to billing details
          </Link>
          <LogoutButton />
        </section>
      </main>
    );
  },
);
