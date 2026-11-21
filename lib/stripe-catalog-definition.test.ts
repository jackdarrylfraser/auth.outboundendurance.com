import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertStripeSubscriptionDefinitionIsConfigured,
  getStripeLivemode,
} from "./stripe-catalog-definition";

describe("Stripe subscription catalog definition", () => {
  it("requires the product and price placeholders to be replaced", () => {
    assert.throws(
      assertStripeSubscriptionDefinitionIsConfigured,
      /Replace the Stripe product name and description placeholders/,
    );
  });

  it("selects the Stripe mode from a standard secret key", () => {
    assert.equal(getStripeLivemode("sk_test_example"), false);
    assert.equal(getStripeLivemode("sk_live_example"), true);
    assert.throws(() => getStripeLivemode("invalid"), /standard Stripe test or live/);
  });
});
