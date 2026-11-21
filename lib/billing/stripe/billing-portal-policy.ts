import Stripe from "stripe";

export const STRIPE_BILLING_PORTAL_CONFIGURATION_NAME =
  "Outbound Endurance Membership Portal";
export const STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER =
  "outbound_endurance_membership_portal";

export type StripeBillingPortalConfigurationCandidate = {
  id: string;
  active: boolean;
  is_default: boolean;
  metadata: Stripe.BillingPortal.Configuration["metadata"];
  features: {
    customer_update?: { enabled?: boolean };
    invoice_history?: { enabled?: boolean };
    payment_method_update?: { enabled?: boolean };
    subscription_cancel?: {
      enabled?: boolean;
      mode?: string;
      proration_behavior?: string;
    };
    subscription_pause?: { enabled?: boolean };
    subscription_update?: { enabled?: boolean };
  };
};

export function getStripeBillingPortalConfigurationFeatures(): Stripe.BillingPortal.ConfigurationCreateParams["features"] {
  return {
    customer_update: {
      enabled: false,
      allowed_updates: [],
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: {
        enabled: false,
        options: [],
      },
    },
    subscription_pause: {
      enabled: false,
    },
    subscription_update: {
      enabled: false,
      default_allowed_updates: [],
    },
  };
}

export function hasRequiredStripeBillingPortalFeatures(
  configuration: StripeBillingPortalConfigurationCandidate,
): boolean {
  const { features } = configuration;

  return (
    configuration.active &&
    features.customer_update?.enabled === false &&
    features.invoice_history?.enabled === true &&
    features.payment_method_update?.enabled === true &&
    features.subscription_cancel?.enabled === true &&
    features.subscription_cancel.mode === "at_period_end" &&
    features.subscription_cancel.proration_behavior === "none" &&
    features.subscription_pause?.enabled === false &&
    features.subscription_update?.enabled === false
  );
}

export function selectStripeBillingPortalConfiguration<
  T extends StripeBillingPortalConfigurationCandidate,
>(
  configurations: readonly T[],
): T | null {
  const matches = configurations.filter(hasRequiredStripeBillingPortalFeatures);
  const managedMatches = matches.filter(
    ({ metadata }) =>
      metadata?.managed_by === STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  );

  if (managedMatches.length > 1) {
    throw new Error(
      "Multiple app-managed Billing Portal configurations match the required features.",
    );
  }
  if (managedMatches.length === 1) {
    return managedMatches[0];
  }

  const defaultMatches = matches.filter(({ is_default }) => is_default);
  if (defaultMatches.length > 1) {
    throw new Error(
      "Multiple default Billing Portal configurations match the required features.",
    );
  }
  if (defaultMatches.length === 1) {
    return defaultMatches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple Billing Portal configurations match the required features.",
    );
  }

  return matches[0] ?? null;
}
