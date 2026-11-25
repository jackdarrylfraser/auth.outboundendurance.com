import { db } from "@/lib/db";
import { stripe } from "@/lib/billing/stripe/client";
import { createStripeSubscriptionService } from "@/lib/billing/stripe/subscription-service";

export { UnlinkedStripeCustomerError } from "@/lib/billing/stripe/subscription-service";

export const stripeSubscriptionService = createStripeSubscriptionService({
  database: db,
  stripeCustomers: stripe.customers,
  stripeSubscriptions: stripe.subscriptions,
});
