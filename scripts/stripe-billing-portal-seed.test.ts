import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStripeBillingPortalConfigurationFeatures,
  STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
  STRIPE_CANCELLATION_FEEDBACK_OPTIONS,
} from "./stripe-billing-portal-seed";

describe("Stripe Billing Portal seed", () => {
  it("defines the provisioned portal features and cancellation feedback", () => {
    const features = getStripeBillingPortalConfigurationFeatures([
      "bfo_course_feedback",
    ]);

    assert.ok(STRIPE_BILLING_PORTAL_CONFIGURATION_NAME);
    assert.ok(STRIPE_CANCELLATION_FEEDBACK_OPTIONS.length > 0);
    assert.equal(features.payment_method_update?.enabled, true);
    assert.equal(features.invoice_history?.enabled, true);
    assert.equal(features.subscription_cancel?.enabled, true);
    assert.equal(features.subscription_cancel?.mode, "at_period_end");
    assert.equal(
      features.subscription_cancel?.cancellation_reason?.enabled,
      true,
    );
    assert.deepEqual(
      features.subscription_cancel?.cancellation_reason?.feedback_options,
      ["bfo_course_feedback"],
    );
    assert.deepEqual(
      features.subscription_cancel?.cancellation_reason?.options,
      ["other"],
    );
    assert.equal(features.subscription_update?.enabled, false);
    assert.equal(features.subscription_pause?.enabled, false);
  });

  it("requires non-empty Stripe feedback option IDs", () => {
    assert.throws(
      () => getStripeBillingPortalConfigurationFeatures([]),
      /At least one Stripe cancellation feedback option is required/,
    );
  });
});
