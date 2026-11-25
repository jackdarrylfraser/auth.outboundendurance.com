import { createStripeSubscriptionService } from "@/lib/billing/stripe/subscription-service";
import { infrastructure } from "@/lib/infrastructure/server";

export { UnlinkedStripeCustomerError } from "@/lib/billing/stripe/subscription-service";

export const stripeSubscriptionService = createStripeSubscriptionService({
  database: infrastructure.db,
  stripeCustomers: infrastructure.stripe.customers,
  stripeSubscriptions: infrastructure.stripe.subscriptions,
});
