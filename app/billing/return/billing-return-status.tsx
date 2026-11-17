"use client";

import { useEffect, useState } from "react";

type BillingStatus = "checking" | "processing" | "confirmed" | "error";
const maxChecks = 10;
const checkIntervalMs = 2_000;

export function BillingReturnStatus() {
  const [status, setStatus] = useState<BillingStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;

    async function checkStatus() {
      try {
        const response = await fetch("/api/billing/return-status", {
          method: "POST",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to check the billing status.");
        }

        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("status" in body) ||
          (body.status !== "processing" && body.status !== "confirmed")
        ) {
          throw new Error("The billing status response was invalid.");
        }

        const result = body.status;
        if (cancelled) {
          return;
        }

        if (result === "confirmed") {
          setStatus("confirmed");
          return;
        }

        checks += 1;
        if (checks >= maxChecks) {
          setStatus("processing");
          return;
        }

        setStatus("checking");
        timer = setTimeout(() => void checkStatus(), checkIntervalMs);
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void checkStatus();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [attempt]);

  if (status === "confirmed") {
    return (
      <div className="mt-3">
        <p aria-live="polite" className="text-sm leading-6 text-zinc-600" role="status">
          Your subscription is active. You can continue to your account.
        </p>
        <a
          className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          href="/account"
        >
          Go to your account
        </a>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-3">
        <p aria-live="polite" className="text-sm leading-6 text-red-700" role="alert">
          We couldn&apos;t check your billing status. Please try again.
        </p>
        <button
          className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          onClick={() => {
            setStatus("checking");
            setAttempt((current) => current + 1);
          }}
          type="button"
        >
          Check again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p aria-live="polite" className="text-sm leading-6 text-zinc-600" role="status">
        {status === "checking"
          ? "Your checkout is still processing. We’re checking for a subscription update."
          : "Your checkout is still processing. It can take a little while for the update to arrive."}
      </p>
      {status === "processing" ? (
        <button
          className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          onClick={() => {
            setStatus("checking");
            setAttempt((current) => current + 1);
          }}
          type="button"
        >
          Check again
        </button>
      ) : null}
      <a
        className="mt-4 block text-sm font-semibold text-blue-700 underline underline-offset-4"
        href="/account"
      >
        Return to your account
      </a>
    </div>
  );
}
