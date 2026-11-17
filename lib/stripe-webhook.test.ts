import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStripeSubscriptionId,
  type StripeWebhookEvent,
} from "./stripe-webhook-policy";
import { getVerifiedStripeCustomerUserId } from "./stripe-customer-link";

function event(
  type: string,
  object: unknown,
  created = 1_800_000_000,
): StripeWebhookEvent {
  return {
    id: "evt_test",
    type,
    created,
    data: { object },
  };
}

describe("Stripe webhook synchronization", () => {
  it("only reconciles a Stripe customer through its server-side user metadata", () => {
    assert.equal(
      getVerifiedStripeCustomerUserId({
        metadata: { userId: "user_123" },
      }),
      "user_123",
    );
    assert.equal(
      getVerifiedStripeCustomerUserId({
        metadata: {},
      }),
      null,
    );
    assert.equal(
      getVerifiedStripeCustomerUserId({
        metadata: { userId: "user_123" },
        deleted: true,
      }),
      null,
    );
  });

  it("extracts string and expanded subscription references from Checkout", () => {
    assert.equal(
      getStripeSubscriptionId(
        event("checkout.session.completed", { subscription: "sub_123" }),
      ),
      "sub_123",
    );
    assert.equal(
      getStripeSubscriptionId(
        event("checkout.session.completed", {
          subscription: { id: "sub_456" },
        }),
      ),
      "sub_456",
    );
    assert.equal(
      getStripeSubscriptionId(
        event("checkout.session.completed", { subscription: null }),
      ),
      null,
    );
  });

  it("extracts IDs from subscription events and ignores unrelated events", () => {
    assert.equal(
      getStripeSubscriptionId(
        event("customer.subscription.updated", { id: "sub_123" }),
      ),
      "sub_123",
    );
    assert.equal(
      getStripeSubscriptionId(event("customer.updated", { id: "cus_123" })),
      null,
    );
  });
});
