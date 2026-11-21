import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertStripeSubscriptionDefinitionIsConfigured,
  getStripeLivemode,
} from "@/lib/billing/stripe/catalog-definition";

describe("Stripe subscription catalog definition", () => {
  it("requires the product and price placeholders to be replaced", () => {
    assert.throws(
      assertStripeSubscriptionDefinitionIsConfigured,
      /Replace the Stripe product name and description placeholders/,
    );
  });

  it("selects the Stripe mode from supported secret key prefixes", () => {
    assert.equal(getStripeLivemode("sk_test_example"), false);
    assert.equal(getStripeLivemode("sk_live_example"), true);
    assert.equal(getStripeLivemode("rk_test_example"), false);
    assert.equal(getStripeLivemode("rk_live_example"), true);
    assert.throws(() => getStripeLivemode("invalid"), /Stripe test or live/);
  });
});
