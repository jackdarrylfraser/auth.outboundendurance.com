import assert from "node:assert/strict";
import type Stripe from "stripe";
import { describe, it } from "node:test";
import {
  createStripeCheckoutService,
  type CheckoutPlan,
} from "@/lib/billing/stripe/checkout";

const user = { id: "user_123", email: "user@example.com" };
const plan: CheckoutPlan = {
  priceId: "price_123",
  name: "Membership",
  description: null,
  unitAmount: 2500,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
};

describe("Stripe checkout", () => {
  it("coordinates the plan, customer, Checkout session, and return URL policies", async () => {
    const calls: string[] = [];
    let sessionParams: Stripe.Checkout.SessionCreateParams | undefined;
    const service = createStripeCheckoutService({
      async getCurrentPlan() {
        calls.push("plan");
        return plan;
      },
      customerService: {
        async getOrCreateStripeCustomer(receivedUser) {
          calls.push("customer");
          assert.deepEqual(receivedUser, user);
          return "cus_123";
        },
      },
      checkoutSessions: {
        async create(params) {
          calls.push("checkout");
          sessionParams = params;
          return { url: "https://checkout.stripe.com/session" };
        },
      },
    });

    const url = await service.createCheckoutSession({
      user,
      baseUrl: "https://auth.example.com",
      returnTo: "https://member.example.com/workouts",
    });

    assert.equal(url, "https://checkout.stripe.com/session");
    assert.deepEqual(calls, ["plan", "customer", "checkout"]);
    assert.deepEqual(sessionParams, {
      mode: "subscription",
      customer: "cus_123",
      line_items: [{ price: "price_123", quantity: 1 }],
      success_url:
        "https://auth.example.com/billing/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        "https://auth.example.com/subscribe?returnTo=https%3A%2F%2Fmember.example.com%2Fworkouts",
      metadata: {
        userId: "user_123",
        returnTo: "https://member.example.com/workouts",
      },
      subscription_data: { metadata: { userId: "user_123" } },
    });
  });

  it("rejects oversized return URLs before creating a session", async () => {
    let createCalls = 0;
    const service = createStripeCheckoutService({
      getCurrentPlan: async () => plan,
      customerService: {
        getOrCreateStripeCustomer: async () => "cus_123",
      },
      checkoutSessions: {
        async create() {
          createCalls += 1;
          return { url: "https://checkout.stripe.com/session" };
        },
      },
    });

    await assert.rejects(
      service.createCheckoutSession({
        user,
        baseUrl: "https://auth.example.com",
        returnTo: `https://member.example.com/${"a".repeat(500)}`,
      }),
      /too long to store in Stripe Checkout metadata/,
    );
    assert.equal(createCalls, 0);
  });

  it("throws if Stripe does not return a Checkout URL", async () => {
    const service = createStripeCheckoutService({
      getCurrentPlan: async () => plan,
      customerService: {
        getOrCreateStripeCustomer: async () => "cus_123",
      },
      checkoutSessions: {
        create: async () => ({ url: null }),
      },
    });

    await assert.rejects(
      service.createCheckoutSession({
        user,
        baseUrl: "https://auth.example.com",
        returnTo: null,
      }),
      /Stripe did not return a Checkout Session URL/,
    );
  });
});
