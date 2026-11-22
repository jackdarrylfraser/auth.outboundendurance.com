"use client";

import { useState } from "react";

export function BillingPortalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function openBillingPortal() {
    setIsLoading(true);
    setHasError(false);

    try {
      const response = await fetch("/api/billing/portal-session", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to create a Stripe Billing Portal session.");
      }

      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== "object" ||
        !("url" in body) ||
        typeof body.url !== "string" ||
        body.url.length === 0
      ) {
        throw new Error("The Stripe Billing Portal response was invalid.");
      }

      window.location.assign(body.url);
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
        disabled={isLoading}
        onClick={openBillingPortal}
        type="button"
      >
        {isLoading ? "Opening subscription management..." : "Manage subscription"}
      </button>
      {hasError ? (
        <p aria-live="polite" className="mt-2 text-sm text-red-700" role="alert">
          We couldn&apos;t open billing right now. Please try again.
        </p>
      ) : null}
    </div>
  );
}
