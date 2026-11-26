"use client";

import { useEffect, useState } from "react";

type BillingStatus = "checking" | "processing" | "confirmed" | "error";
const maxChecks = 10;
const checkIntervalMs = 2_000;

export function BillingReturnStatus({
  returnTo,
}: {
  returnTo: string | null;
}) {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnTo }),
        });

        if (!response.ok) {
          throw new Error("Unable to check the billing status.");
        }

        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("status" in body) ||
          (body.status !== "processing" && body.status !== "confirmed") ||
          ("returnTo" in body &&
            body.returnTo !== null &&
            typeof body.returnTo !== "string")
        ) {
          throw new Error("The billing status response was invalid.");
        }

        const result = body.status;
        if (cancelled) {
          return;
        }

        if (result === "confirmed") {
          const destination =
            "returnTo" in body && typeof body.returnTo === "string"
              ? body.returnTo
              : null;
          setStatus("confirmed");
          if (destination) {
            timer = setTimeout(
              () => window.location.assign(destination),
              1_200,
            );
          }
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
  }, [attempt, returnTo]);

  if (status === "confirmed") {
    return (
      <div className="mt-3">
        <p
          aria-live="polite"
          className="text-sm leading-6 text-muted-foreground"
          role="status"
        >
          {returnTo
            ? "Your subscription is active. Redirecting to the page you originally requested."
            : "Your subscription is active. You can manage your subscription."}
        </p>
        <a
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          href="/manage"
        >
          Manage subscription
        </a>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-3">
        <p aria-live="polite" className="text-sm leading-6 text-danger-foreground" role="alert">
          We couldn&apos;t check your billing status. Please try again.
        </p>
        <button
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background"
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
      <p aria-live="polite" className="text-sm leading-6 text-muted-foreground" role="status">
        {status === "checking"
          ? "Your purchase is being confirmed. We’re checking for the subscription update."
          : "Your purchase is still processing. It can take a little while for the update to arrive."}
      </p>
      {status === "processing" ? (
        <button
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background"
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
        className="mt-4 block text-sm font-semibold text-primary underline underline-offset-4"
        href="/manage"
      >
        Manage your subscription
      </a>
    </div>
  );
}
