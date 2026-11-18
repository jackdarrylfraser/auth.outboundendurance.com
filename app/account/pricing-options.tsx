"use client";

import { useEffect, useState } from "react";
import type { CheckoutPlan } from "@/lib/stripe-checkout";

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
  const [plans, setPlans] = useState<CheckoutPlan[] | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      setPlansError(false);

      try {
        const response = await fetch("/api/billing/plans", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Unable to load subscription plans.");
        }

        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("plans" in body) ||
          !Array.isArray(body.plans) ||
          !body.plans.every(isCheckoutPlan)
        ) {
          throw new Error("The subscription plans response was invalid.");
        }

        if (!cancelled) {
          setPlans(body.plans);
        }
      } catch {
        if (!cancelled) {
          setPlansError(true);
        }
      }
    }

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function beginCheckout(priceId: string) {
    setPendingPriceId(priceId);
    setError("");

    try {
      const response = await fetch("/api/billing/checkout-session", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, returnTo }),
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
      setPendingPriceId(null);
    }
  }

  return (
    <section aria-label="Available subscription plans">
      {plansError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>We couldn&apos;t load plans. Please try again.</p>
          <button
            className="mt-3 font-semibold underline underline-offset-4"
            onClick={() => {
              setPlans(null);
              setPlansError(false);
              setAttempt((current) => current + 1);
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : plans === null ? (
        <p aria-live="polite" className="text-sm text-zinc-600" role="status">
          Loading plans...
        </p>
      ) : (
        <>
      {error ? (
        <p className="mb-5 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {plans.map((plan) => (
          <article
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            key={plan.priceId}
          >
            <h2 className="text-lg font-semibold text-zinc-950">{plan.name}</h2>
            {plan.description ? (
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {plan.description}
              </p>
            ) : null}
            <p className="mt-5 text-2xl font-semibold text-zinc-950">
              {formatPrice(plan)}
              <span className="ml-1 text-sm font-normal text-zinc-600">
                {formatInterval(plan)}
              </span>
            </p>
            <button
              className="mt-5 flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingPriceId !== null}
              onClick={() => void beginCheckout(plan.priceId)}
              type="button"
            >
              {pendingPriceId === plan.priceId
                ? "Opening secure checkout..."
                : "Choose plan"}
            </button>
          </article>
        ))}
      </div>
        </>
      )}
    </section>
  );
}
