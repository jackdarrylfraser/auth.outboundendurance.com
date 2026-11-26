import type Stripe from "stripe";

export const STRIPE_SUBSCRIPTION_CATALOG_KEY =
  "outboundendurance_subscription";
export const STRIPE_CATALOG_MANAGED_BY = "auth.outboundendurance.com";

export const stripeSubscriptionDefinition = {
  product: {
    name: "Self Guided Exercise, Nutrition & Recovery Course",
    description:
      "A self-paced course with practical guidance on exercise, nutrition, and recovery to support your endurance training and help you build sustainable habits.",
  },
  price: {
    unitAmount: 2500,
    currency: "usd",
    interval: "month" satisfies Stripe.PriceCreateParams.Recurring.Interval,
    intervalCount: 1,
  },
} as const;

export function assertStripeSubscriptionDefinitionIsConfigured(): void {
  const { product, price } = stripeSubscriptionDefinition;

  if (
    !product.name.trim() ||
    product.name.startsWith("REPLACE_WITH_") ||
    product.description?.startsWith("REPLACE_WITH_")
  ) {
    throw new Error(
      "Replace the Stripe product name and description placeholders in scripts/stripe-catalog-seed.ts.",
    );
  }

  if (!Number.isSafeInteger(price.unitAmount) || price.unitAmount <= 0) {
    throw new Error(
      "Set the Stripe subscription amount in minor currency units in scripts/stripe-catalog-seed.ts.",
    );
  }

  if (!/^[a-z]{3}$/.test(price.currency)) {
    throw new Error(
      "Set the three-letter lowercase Stripe currency in scripts/stripe-catalog-seed.ts.",
    );
  }

  if (!Number.isSafeInteger(price.intervalCount) || price.intervalCount < 1) {
    throw new Error(
      "Set a positive Stripe subscription interval count in scripts/stripe-catalog-seed.ts.",
    );
  }
}
