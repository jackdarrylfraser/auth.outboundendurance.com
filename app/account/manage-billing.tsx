"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
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

function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const fractionDigits =
    formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** fractionDigits);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function PaymentSetupForm({
  onComplete,
  onError,
}: {
  onComplete(setupIntentId: string): Promise<void>;
  onError(message: string): void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsPending(true);
    onError("");
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: new URL(
            window.location.pathname,
            window.location.origin,
          ).href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        onError(
          result.error.message ??
            "We couldn't update your payment method. Please try again.",
        );
      } else if (result.setupIntent?.status === "succeeded") {
        await onComplete(result.setupIntent.id);
      } else {
        onError("Payment method setup did not complete. Please try again.");
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "We couldn't update your payment method. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="mt-5 border-t border-border pt-5" onSubmit={submit}>
      <PaymentElement />
      <button
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
        disabled={!stripe || !elements || isPending}
        type="submit"
      >
        {isPending ? "Saving payment method..." : "Save payment method"}
      </button>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Your payment details are securely processed by Stripe.
      </p>
    </form>
  );
}

export function ManageBilling({ data }: { data: ManageBillingData }) {
  const router = useRouter();
  const [setupIntent, setSetupIntent] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [isConfirmingCancellation, setIsConfirmingCancellation] =
    useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [hasScheduledCancellation, setHasScheduledCancellation] = useState(
    data.subscription.cancelAtPeriodEnd,
  );
  const [cancellationDate, setCancellationDate] = useState(
    data.subscription.cancelAt ?? data.subscription.currentPeriodEnd,
  );
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  const finalizedSetupIntent = useRef<string | null>(null);

  const stripePromise = useMemo(
    () =>
      setupIntent ? loadStripe(setupIntent.publishableKey) : null,
    [setupIntent],
  );

  const finalizePaymentMethod = useCallback(async (setupIntentId: string) => {
    if (finalizedSetupIntent.current === setupIntentId) {
      return;
    }
    finalizedSetupIntent.current = setupIntentId;
    setPaymentError("");

    try {
      const response = await fetch("/api/billing/payment-method/confirm", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            "We couldn't verify the updated payment method. Please try again.",
          ),
        );
      }

      setSetupIntent(null);
      setPaymentMessage("Your payment method has been updated.");
      const url = new URL(window.location.href);
      url.searchParams.delete("setup_intent");
      url.searchParams.delete("setup_intent_client_secret");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      router.refresh();
    } catch (error) {
      finalizedSetupIntent.current = null;
      setPaymentError(
        error instanceof Error
          ? error.message
          : "We couldn't verify the updated payment method. Please try again.",
      );
    }
  }, [router]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const setupIntentId = url.searchParams.get("setup_intent");
    if (!setupIntentId) {
      return;
    }

    const timer = window.setTimeout(
      () => void finalizePaymentMethod(setupIntentId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [finalizePaymentMethod]);

  async function beginPaymentUpdate() {
    setIsPreparingPayment(true);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(
        "/api/billing/payment-method/setup-intent",
        { method: "POST", cache: "no-store" },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            "We couldn't prepare a payment method update. Please try again.",
          ),
        );
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("clientSecret" in body) ||
        typeof body.clientSecret !== "string" ||
        !("publishableKey" in body) ||
        typeof body.publishableKey !== "string"
      ) {
        throw new Error("The payment setup response was invalid.");
      }
      setSetupIntent({
        clientSecret: body.clientSecret,
        publishableKey: body.publishableKey,
      });
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "We couldn't prepare a payment method update. Please try again.",
      );
    } finally {
      setIsPreparingPayment(false);
    }
  }

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

  const endDate = formatDate(cancellationDate);

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-labelledby="subscription-heading"
        className="rounded-xl border border-border p-5"
      >
        <h2
          className="text-lg font-semibold text-foreground"
          id="subscription-heading"
        >
          Subscription
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: <span className="capitalize">{data.subscription.status.replaceAll("_", " ")}</span>
        </p>
        {hasScheduledCancellation ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is scheduled to end on {endDate}.
          </p>
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
                  Cancellation will take effect on {endDate}. You won&apos;t
                  be charged for a renewal after that date.
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

      <section
        aria-labelledby="payment-method-heading"
        className="rounded-xl border border-border p-5"
      >
        <h2
          className="text-lg font-semibold text-foreground"
          id="payment-method-heading"
        >
          Payment method
        </h2>
        {data.paymentMethod?.card ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {data.paymentMethod.card.brand} ending in{" "}
            {data.paymentMethod.card.last4}, expires{" "}
            {String(data.paymentMethod.card.expMonth).padStart(2, "0")}/
            {data.paymentMethod.card.expYear}
          </p>
        ) : data.paymentMethod ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {data.paymentMethod.type}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No saved payment method is available.
          </p>
        )}
        {paymentMessage ? (
          <p className="mt-3 text-sm text-success-foreground" role="status">
            {paymentMessage}
          </p>
        ) : null}
        {paymentError ? (
          <p className="mt-3 text-sm text-danger-foreground" role="alert">
            {paymentError}
          </p>
        ) : null}
        {setupIntent && stripePromise ? (
          <Elements
            key={setupIntent.clientSecret}
            options={{
              clientSecret: setupIntent.clientSecret,
              appearance: { theme: "stripe" },
            }}
            stripe={stripePromise}
          >
            <PaymentSetupForm
              onComplete={finalizePaymentMethod}
              onError={setPaymentError}
            />
          </Elements>
        ) : (
          <button
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-background disabled:cursor-wait disabled:opacity-60"
            disabled={isPreparingPayment}
            onClick={() => void beginPaymentUpdate()}
            type="button"
          >
            {isPreparingPayment
              ? "Preparing secure form..."
              : data.paymentMethod
                ? "Update payment method"
                : "Add payment method"}
          </button>
        )}
      </section>

      <section
        aria-labelledby="payment-history-heading"
        className="rounded-xl border border-border p-5"
      >
        <h2
          className="text-lg font-semibold text-foreground"
          id="payment-history-heading"
        >
          Payment history
        </h2>
        {data.invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No invoices are available yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.invoices.map((invoice) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                key={invoice.id}
              >
                <div>
                  <p className="font-medium text-foreground">
                    {formatDate(invoice.createdAt)}
                  </p>
                  <p className="mt-1 capitalize text-muted-foreground">
                    {invoice.number ? `${invoice.number} · ` : ""}
                    {invoice.status ?? "invoice"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-foreground">
                    {formatCurrency(
                      invoice.status === "paid"
                        ? invoice.amountPaid
                        : invoice.total,
                      invoice.currency,
                    )}
                  </span>
                  {invoice.hostedInvoiceUrl || invoice.invoicePdf ? (
                    <a
                      className="font-semibold text-primary underline underline-offset-4"
                      href={invoice.hostedInvoiceUrl ?? invoice.invoicePdf ?? ""}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
