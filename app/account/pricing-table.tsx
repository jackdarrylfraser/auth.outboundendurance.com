"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { env } from "@/lib/env";

export function PricingTable() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerSession() {
      setSessionError(false);

      try {
        const response = await fetch("/api/billing/customer-session", {
          method: "POST",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to create a Stripe Customer Session.");
        }

        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("clientSecret" in body) ||
          typeof body.clientSecret !== "string" ||
          body.clientSecret.length === 0
        ) {
          throw new Error("The Stripe Customer Session response was invalid.");
        }

        if (!cancelled) {
          setClientSecret(body.clientSecret);
        }
      } catch {
        if (!cancelled) {
          setSessionError(true);
        }
      }
    }

    void loadCustomerSession();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setClientSecret(null);
    setSessionError(false);
    setAttempt((current) => current + 1);
  }

  return (
    <section aria-label="Available subscription plans">
      <Script
        onError={() => setScriptError(true)}
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="afterInteractive"
      />
      {scriptError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>We couldn&apos;t load the pricing table. Please refresh the page.</p>
          <button
            className="mt-3 font-semibold underline underline-offset-4"
            onClick={() => window.location.reload()}
            type="button"
          >
            Refresh
          </button>
        </div>
      ) : sessionError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>We couldn&apos;t load plans. Please try again.</p>
          <button
            className="mt-3 font-semibold underline underline-offset-4"
            onClick={retry}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : clientSecret ? (
        <stripe-pricing-table
          customer-session-client-secret={clientSecret}
          pricing-table-id={env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID}
          publishable-key={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
        />
      ) : (
        <p aria-live="polite" className="text-sm text-zinc-600" role="status">
          Loading plans...
        </p>
      )}
    </section>
  );
}
