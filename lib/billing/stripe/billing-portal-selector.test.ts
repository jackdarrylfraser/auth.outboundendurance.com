import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectStripeBillingPortalConfiguration,
  STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  type StripeBillingPortalConfigurationCandidate,
} from "@/lib/billing/stripe/billing-portal-selector";

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
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
      },
      subscription_pause: { enabled: false },
      subscription_update: { enabled: false },
    },
  };
}

describe("Stripe Billing Portal configuration selection", () => {
  it("finds a configuration by its required feature settings", () => {
    const candidate = configuration("bpc_expected");

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

    assert.equal(
      selectStripeBillingPortalConfiguration([inactive, switchable]),
      null,
    );
  });
});
