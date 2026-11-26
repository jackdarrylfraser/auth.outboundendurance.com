"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { SubscriptionPlan } from "@/lib/billing/stripe/subscription-catalog";

type PricingOptionsProps = {
  returnTo: string | null;
};

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
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

function formatPrice(plan: SubscriptionPlan): string {
  const currencyFormat = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency,
  });
  const fractionDigits =
    currencyFormat.resolvedOptions().maximumFractionDigits ?? 2;

  return currencyFormat.format(plan.unitAmount / 10 ** fractionDigits);
}

function formatInterval(plan: SubscriptionPlan): string {
  const count = plan.intervalCount;
  const interval = count === 1 ? plan.interval : `${plan.interval}s`;
  return `per ${count === 1 ? "" : `${count} `}${interval}`;
}

function getBillingReturnUrl(returnTo: string | null): string {
  const returnUrl = new URL("/billing/return", window.location.origin);
  if (returnTo) {
    returnUrl.searchParams.set("returnTo", returnTo);
  }
  return returnUrl.href;
}

function InlinePaymentForm({
  returnTo,
  amountLabel,
}: {
  returnTo: string | null;
  amountLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsPending(true);
    setError("");

    try {
      const returnUrl = getBillingReturnUrl(returnTo);
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (result.error) {
        setError(
          result.error.message ??
            "We couldn't confirm your payment. Check your details and try again.",
        );
        setIsPending(false);
        return;
      }

      window.location.assign(returnUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't confirm your payment. Please try again.",
      );
      setIsPending(false);
    }
  }

  return (
    <form className="mt-6 border-t border-border pt-5" onSubmit={submitPayment}>
      <h3 className="mb-3 text-base font-semibold text-foreground">
        Pick your payment method
      </h3>
      <PaymentElement />
      {error ? (
        <p className="mt-4 text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!stripe || !elements || isPending}
        type="submit"
      >
        {isPending ? "Processing payment..." : `Subscribe — ${amountLabel}`}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        Your payment details are securely processed by Stripe.
      </p>
    </form>
  );
}

export function PricingOptions({ returnTo }: PricingOptionsProps) {
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

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
          !isSubscriptionPlan(body.plan) ||
          !("publishableKey" in body) ||
          typeof body.publishableKey !== "string"
        ) {
          throw new Error("The subscription price response was invalid.");
        }

        if (!cancelled) {
          setPlan(body.plan);
          setPublishableKey(body.publishableKey);
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

  async function beginPayment() {
    setIsPending(true);
    setError("");

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/billing/subscription-intent", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey.current }),
      });

      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "We couldn't prepare your payment. Please try again.";
        throw new Error(message);
      }

      if (
        !body ||
        typeof body !== "object" ||
        !("clientSecret" in body) ||
        typeof body.clientSecret !== "string" ||
        body.clientSecret.length === 0
      ) {
        throw new Error("The payment setup response was invalid.");
      }

      setClientSecret(body.clientSecret);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't prepare your payment. Please try again.",
      );
    } finally {
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
              setPublishableKey(null);
              setPriceError(false);
              setAttempt((current) => current + 1);
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : plan === null ? (
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground"
          role="status"
        >
          Loading subscription price...
        </p>
      ) : (
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
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
          {error ? (
            <p className="mt-5 text-sm text-danger-foreground" role="alert">
              {error}
            </p>
          ) : null}
          {clientSecret && stripePromise ? (
            <Elements
              options={{ clientSecret, appearance: { theme: "stripe" } }}
              stripe={stripePromise}
            >
              <InlinePaymentForm
                amountLabel={formatPrice(plan)}
                returnTo={returnTo}
              />
            </Elements>
          ) : (
            <>
              <button
                className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                onClick={() => void beginPayment()}
                type="button"
              >
                {isPending
                  ? "Preparing secure payment..."
                  : "Continue to payment"}
              </button>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                You&apos;ll review and confirm the recurring payment before
                subscribing.
              </p>
            </>
          )}
        </article>
      )}
    </section>
  );
}
