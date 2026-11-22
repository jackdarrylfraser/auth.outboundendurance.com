"use client";

import { useEffect, useState } from "react";
import type { CheckoutPlan } from "@/lib/billing/stripe/checkout";

type PricingOptionsProps = {
  returnTo: string | null;
};

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return (
    typeof value === "object" &&
    value !== null &&
    "priceId" in value &&
    typeof value.priceId === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "description" in value &&
    (typeof value.description === "string" || value.description === null) &&
    "unitAmount" in value &&
    typeof value.unitAmount === "number" &&
    "currency" in value &&
    typeof value.currency === "string" &&
    "interval" in value &&
    typeof value.interval === "string" &&
    "intervalCount" in value &&
    typeof value.intervalCount === "number"
  );
}

function formatPrice(plan: CheckoutPlan): string {
  const currencyFormat = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency,
  });
  const fractionDigits =
    currencyFormat.resolvedOptions().maximumFractionDigits ?? 2;

  return currencyFormat.format(
    plan.unitAmount / 10 ** fractionDigits,
  );
}

function formatInterval(plan: CheckoutPlan): string {
  const count = plan.intervalCount;
  const interval = count === 1 ? plan.interval : `${plan.interval}s`;
  return `per ${count === 1 ? "" : `${count} `}${interval}`;
}

export function PricingOptions({ returnTo }: PricingOptionsProps) {
  const [plan, setPlan] = useState<CheckoutPlan | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      setPriceError(false);

      try {
        const response = await fetch("/api/billing/price", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load the subscription price.");
        }

        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("plan" in body) ||
          !isCheckoutPlan(body.plan)
        ) {
          throw new Error("The subscription price response was invalid.");
        }

        if (!cancelled) {
          setPlan(body.plan);
        }
      } catch {
        if (!cancelled) {
          setPriceError(true);
        }
      }
    }

    void loadPrice();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function beginCheckout() {
    setIsPending(true);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout-session", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });

      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "We couldn't start checkout. Please try again.";
        throw new Error(message);
      }

      if (
        !body ||
        typeof body !== "object" ||
        !("url" in body) ||
        typeof body.url !== "string" ||
        body.url.length === 0
      ) {
        throw new Error("The Stripe Checkout response was invalid.");
      }

      window.location.assign(body.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't start checkout. Please try again.",
      );
      setIsPending(false);
    }
  }

  return (
    <section aria-label="Subscription">
      {priceError ? (
        <div className="rounded-xl border border-danger-border bg-danger-surface p-5 text-sm text-danger-foreground">
          <p>We couldn&apos;t load the subscription price. Please try again.</p>
          <button
            className="mt-3 font-semibold underline underline-offset-4"
            onClick={() => {
              setPlan(null);
              setPriceError(false);
              setAttempt((current) => current + 1);
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : plan === null ? (
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          Loading subscription price...
        </p>
      ) : (
        <>
          {error ? (
            <p className="mb-5 text-sm text-danger-foreground" role="alert">
              {error}
            </p>
          ) : null}
          <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              {plan.name}
            </h2>
            {plan.description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {plan.description}
              </p>
            ) : null}
            <p className="mt-5 text-2xl font-semibold text-foreground">
              {formatPrice(plan)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {formatInterval(plan)}
              </span>
            </p>
            <button
              className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => void beginCheckout()}
              type="button"
            >
              {isPending ? "Opening secure checkout..." : "Subscribe"}
            </button>
          </article>
        </>
      )}
    </section>
  );
}
