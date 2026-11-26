import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertStripeSubscriptionDefinitionIsConfigured } from "./stripe-catalog-seed";

describe("Stripe subscription catalog seed", () => {
  it("contains configured product and recurring price values", () => {
    assert.doesNotThrow(assertStripeSubscriptionDefinitionIsConfigured);
  });
});
