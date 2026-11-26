import type Stripe from "stripe";

type SubscriptionInvoice =
  | string
  | {
      confirmation_secret?: { client_secret: string } | null;
    }
  | null;

export function getSubscriptionPaymentClientSecret(
  latestInvoice: SubscriptionInvoice,
): string | null {
  if (!latestInvoice || typeof latestInvoice === "string") {
    return null;
  }

  return latestInvoice.confirmation_secret?.client_secret ?? null;
}

type SubscriptionOperations = {
  create(
    params: Stripe.SubscriptionCreateParams,
    options: Stripe.RequestOptions,
  ): Promise<{ latest_invoice: SubscriptionInvoice }>;
};

export function createStripePaymentElementService(dependencies: {
  subscriptions: SubscriptionOperations;
}) {
  async function createSubscription(input: {
    customerId: string;
    userId: string;
    priceId: string;
    idempotencyKey: string;
  }): Promise<string> {
    const subscription = await dependencies.subscriptions.create(
      {
        customer: input.customerId,
        items: [{ price: input.priceId, quantity: 1 }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata: {
          userId: input.userId,
          payment_flow: "payment_element",
        },
        expand: ["latest_invoice.confirmation_secret"],
      },
      { idempotencyKey: input.idempotencyKey },
    );

    const clientSecret = getSubscriptionPaymentClientSecret(
      subscription.latest_invoice,
    );
    if (!clientSecret) {
      throw new Error(
        "Stripe did not return a payment confirmation secret for the subscription.",
      );
    }

    return clientSecret;
  }

  return { createSubscription };
}
