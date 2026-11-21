import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStripeBillingPortalConfigurationFeatures,
  hasRequiredStripeBillingPortalFeatures,
  selectStripeBillingPortalConfiguration,
  STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  type StripeBillingPortalConfigurationCandidate,
} from "./stripe-billing-portal-policy";

function configuration(
  id: string,
  options: { isDefault?: boolean; managed?: boolean } = {},
): StripeBillingPortalConfigurationCandidate {
  return {
    id,
    active: true,
    is_default: options.isDefault ?? false,
    metadata: options.managed
      ? { managed_by: STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER }
      : null,
    features: getStripeBillingPortalConfigurationFeatures(),
  };
}

describe("Stripe Billing Portal configuration", () => {
  it("allows payment updates, invoices, and cancellation at period end only", () => {
    const features = getStripeBillingPortalConfigurationFeatures();

    assert.equal(features.payment_method_update?.enabled, true);
    assert.equal(features.invoice_history?.enabled, true);
    assert.equal(features.subscription_cancel?.enabled, true);
    assert.equal(features.subscription_cancel?.mode, "at_period_end");
    assert.equal(features.subscription_update?.enabled, false);
    assert.equal(features.subscription_pause?.enabled, false);
  });

  it("finds a configuration by its required feature settings", () => {
    const candidate = configuration("bpc_expected");

    assert.equal(hasRequiredStripeBillingPortalFeatures(candidate), true);
    assert.equal(
      selectStripeBillingPortalConfiguration([candidate])?.id,
      candidate.id,
    );
  });

  it("prefers the app-managed match and rejects ambiguous matches", () => {
    const managed = configuration("bpc_managed", { managed: true });
    const defaultConfiguration = configuration("bpc_default", {
      isDefault: true,
    });

    assert.equal(
      selectStripeBillingPortalConfiguration([
        defaultConfiguration,
        managed,
      ])?.id,
      managed.id,
    );
    assert.throws(() =>
      selectStripeBillingPortalConfiguration([
        configuration("bpc_one"),
        configuration("bpc_two"),
      ]),
    );
  });

  it("does not select inactive or feature-incompatible configurations", () => {
    const inactive = configuration("bpc_inactive");
    inactive.active = false;
    const switchable = configuration("bpc_switchable");
    switchable.features.subscription_update = { enabled: true };

    assert.equal(hasRequiredStripeBillingPortalFeatures(inactive), false);
    assert.equal(
      selectStripeBillingPortalConfiguration([inactive, switchable]),
      null,
    );
  });
});
