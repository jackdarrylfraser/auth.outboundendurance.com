import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCheckoutCancelUrl,
  getCheckoutSuccessUrl,
  isCheckoutSessionId,
  parseAllowedStripePriceIds,
} from "./stripe-checkout-policy";

describe("Stripe checkout policy", () => {
  it("parses and de-duplicates the configured Price ID allowlist", () => {
    assert.deepEqual(
      parseAllowedStripePriceIds(" price_one,price_two, price_one "),
      ["price_one", "price_two"],
    );
  });

  it("rejects an empty or malformed Price ID allowlist", () => {
    assert.throws(() => parseAllowedStripePriceIds(" , "));
    assert.throws(() => parseAllowedStripePriceIds("price_valid,not-a-price"));
  });

  it("creates a Stripe success URL with the Checkout Session placeholder", () => {
    assert.equal(
      getCheckoutSuccessUrl("https://auth.outboundendurance.com"),
      "https://auth.outboundendurance.com/billing/return?session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("preserves the validated return URL on checkout cancellation", () => {
    assert.equal(
      getCheckoutCancelUrl(
        "https://auth.outboundendurance.com",
        "https://member.outboundendurance.com/workouts?week=4",
      ),
      "https://auth.outboundendurance.com/account?returnTo=https%3A%2F%2Fmember.outboundendurance.com%2Fworkouts%3Fweek%3D4",
    );
  });

  it("accepts only Stripe Checkout Session IDs", () => {
    assert.equal(isCheckoutSessionId("cs_test_123"), true);
    assert.equal(isCheckoutSessionId("cs_live_123"), true);
    assert.equal(isCheckoutSessionId("cs_123"), false);
    assert.equal(isCheckoutSessionId("price_123"), false);
  });
});
