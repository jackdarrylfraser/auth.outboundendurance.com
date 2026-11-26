import type Stripe from "stripe";

export const STRIPE_BILLING_PORTAL_CONFIGURATION_NAME =
  "Outbound Endurance Membership Portal";
export const STRIPE_CANCELLATION_FEEDBACK_OPTIONS = [
  "I completed the course",
  "I haven't had time to work through the course",
  "The course wasn't a good fit for my goals",
  "I wanted personal coaching or feedback",
  "I had trouble accessing the course materials",
  "The price wasn't right for me",
] as const;

export function getStripeBillingPortalConfigurationFeatures(
  feedbackOptionIds: readonly string[],
): Stripe.BillingPortal.ConfigurationCreateParams["features"] {
  if (feedbackOptionIds.length === 0) {
    throw new Error(
      "At least one Stripe cancellation feedback option is required.",
    );
  }

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
        enabled: true,
        feedback_options: [...feedbackOptionIds],
        options: ["other"],
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
