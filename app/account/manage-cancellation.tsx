"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StripeManagePageData } from "@/lib/billing/stripe/manage-service";

type ManageBillingData = NonNullable<StripeManagePageData>;

function getErrorMessage(body: unknown, fallback: string): string {
  return body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ManageCancellation({ data }: { data: ManageBillingData }) {
  const router = useRouter();
  const [isConfirmingCancellation, setIsConfirmingCancellation] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [hasScheduledCancellation, setHasScheduledCancellation] = useState(
    data.subscription.cancelAtPeriodEnd,
  );
  const [cancellationDate, setCancellationDate] = useState(
    data.subscription.cancelAt ?? data.subscription.currentPeriodEnd,
  );
  const [cancellationError, setCancellationError] = useState("");

  async function cancelSubscription() {
    setIsCancelling(true);
    setCancellationError("");

    try {
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            "We couldn't cancel your subscription. Please try again.",
          ),
        );
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("cancelAtPeriodEnd" in body) ||
        body.cancelAtPeriodEnd !== true ||
        !("currentPeriodEnd" in body) ||
        typeof body.currentPeriodEnd !== "string"
      ) {
        throw new Error("The cancellation response was invalid.");
      }

      setHasScheduledCancellation(true);
      setCancellationDate(body.currentPeriodEnd);
      setIsConfirmingCancellation(false);
      router.refresh();
    } catch (error) {
      setCancellationError(
        error instanceof Error
          ? error.message
          : "We couldn't cancel your subscription. Please try again.",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function resumeSubscription() {
    setIsResuming(true);
    setCancellationError("");

    try {
      const response = await fetch("/api/billing/subscription/resume", {
        method: "POST",
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            "We couldn't resume your subscription. Please try again.",
          ),
        );
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("cancelAtPeriodEnd" in body) ||
        body.cancelAtPeriodEnd !== false ||
        !("currentPeriodEnd" in body) ||
        typeof body.currentPeriodEnd !== "string"
      ) {
        throw new Error("The subscription resume response was invalid.");
      }

      setHasScheduledCancellation(false);
      setCancellationDate(body.currentPeriodEnd);
      router.refresh();
    } catch (error) {
      setCancellationError(
        error instanceof Error
          ? error.message
          : "We couldn't resume your subscription. Please try again.",
      );
    } finally {
      setIsResuming(false);
    }
  }

  const endDate = formatDate(cancellationDate);

  return (
    <section
      aria-labelledby="subscription-heading"
      className="mt-8 rounded-xl border border-border p-5"
    >
      <h2
        className="text-lg font-semibold text-foreground"
        id="subscription-heading"
      >
        Subscription
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Status:{" "}
        <span className="capitalize">
          {data.subscription.status.replaceAll("_", " ")}
        </span>
      </p>
      {data.subscription.status === "canceled" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Your subscription has been canceled.
        </p>
      ) : hasScheduledCancellation ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is scheduled to end on {endDate}.
          </p>
          <button
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background disabled:cursor-wait disabled:opacity-60"
            disabled={isResuming}
            onClick={() => void resumeSubscription()}
            type="button"
          >
            {isResuming ? "Resuming..." : "Resume subscription"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.subscription.status === "active" ||
            data.subscription.status === "trialing"
              ? `Your next renewal is ${endDate}.`
              : `Your current billing period ends ${endDate}.`}
          </p>
          <button
            className="mt-5 rounded-lg border border-danger-border px-4 py-2 text-sm font-semibold text-danger-foreground hover:bg-danger-surface"
            onClick={() => setIsConfirmingCancellation(true)}
            type="button"
          >
            Cancel subscription
          </button>
          {isConfirmingCancellation ? (
            <div className="mt-4 rounded-lg border border-danger-border bg-danger-surface p-4">
              <p className="text-sm text-danger-foreground">
                Cancellation will take effect on {endDate}. You won&apos;t be
                charged for a renewal after that date.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className="rounded-lg border border-danger-border bg-background px-4 py-2 text-sm font-semibold text-danger-foreground disabled:opacity-60"
                  disabled={isCancelling}
                  onClick={() => void cancelSubscription()}
                  type="button"
                >
                  {isCancelling ? "Canceling..." : "Confirm cancellation"}
                </button>
                <button
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
                  disabled={isCancelling}
                  onClick={() => setIsConfirmingCancellation(false)}
                  type="button"
                >
                  Keep subscription
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {cancellationError ? (
        <p className="mt-3 text-sm text-danger-foreground" role="alert">
          {cancellationError}
        </p>
      ) : null}
    </section>
  );
}
