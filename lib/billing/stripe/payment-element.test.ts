import assert from "node:assert/strict";
import type Stripe from "stripe";
import { describe, it } from "node:test";
import {
  createStripePaymentElementService,
  getSubscriptionPaymentClientSecret,
} from "@/lib/billing/stripe/payment-element";

describe("Stripe Payment Element service", () => {
  it("creates an incomplete subscription and returns its invoice confirmation secret", async () => {
    let receivedParams: Stripe.SubscriptionCreateParams | undefined;
    let receivedOptions: Stripe.RequestOptions | undefined;
    const service = createStripePaymentElementService({
      subscriptions: {
        async create(params, options) {
          receivedParams = params;
          receivedOptions = options;
          return {
            latest_invoice: {
              confirmation_secret: { client_secret: "pi_secret_123" },
            },
          };
        },
      },
    });

    const clientSecret = await service.createSubscription({
      customerId: "cus_123",
      userId: "user_123",
      priceId: "price_123",
      idempotencyKey: "request-key",
    });

    assert.equal(clientSecret, "pi_secret_123");
    assert.deepEqual(receivedParams, {
      customer: "cus_123",
      items: [{ price: "price_123", quantity: 1 }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      metadata: {
        userId: "user_123",
        payment_flow: "payment_element",
      },
      expand: ["latest_invoice.confirmation_secret"],
    });
    assert.deepEqual(receivedOptions, { idempotencyKey: "request-key" });
  });

  it("fails explicitly when Stripe does not return a confirmation secret", async () => {
    const service = createStripePaymentElementService({
      subscriptions: {
        async create() {
          return { latest_invoice: null };
        },
      },
    });

    await assert.rejects(
      service.createSubscription({
        customerId: "cus_123",
        userId: "user_123",
        priceId: "price_123",
        idempotencyKey: "request-key",
      }),
      /did not return a payment confirmation secret/,
    );
  });

  it("returns no secret for an unexpanded or missing invoice", () => {
    assert.equal(getSubscriptionPaymentClientSecret(null), null);
    assert.equal(
      getSubscriptionPaymentClientSecret("in_123"),
      null,
    );
  });
});
