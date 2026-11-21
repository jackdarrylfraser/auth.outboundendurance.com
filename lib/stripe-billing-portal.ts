import Stripe from "stripe";
import { selectStripeBillingPortalConfiguration } from "./stripe-billing-portal-policy";

export async function findStripeBillingPortalConfiguration(
  stripeClient: Stripe,
): Promise<Stripe.BillingPortal.Configuration | null> {
  const configurations: Stripe.BillingPortal.Configuration[] = [];

  for await (const configuration of stripeClient.billingPortal.configurations.list(
    { limit: 100 },
  )) {
    configurations.push(configuration);
  }

  return selectStripeBillingPortalConfiguration(configurations);
}
