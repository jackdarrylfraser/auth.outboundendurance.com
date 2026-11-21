import Stripe from "stripe";
import { z } from "zod";
import {
  findStripeBillingPortalConfiguration,
} from "@/lib/billing/stripe/billing-portal";
import {
  getStripeBillingPortalConfigurationFeatures,
  STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
} from "@/lib/billing/stripe/billing-portal-policy";
import { getStripeLivemode } from "@/lib/billing/stripe/catalog-definition";

const scriptEnv = z
  .object({
    STRIPE_SECRET_KEY: z.string().trim().min(1),
  })
  .parse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  });

const isLiveMode = getStripeLivemode(scriptEnv.STRIPE_SECRET_KEY);
const stripe = new Stripe(scriptEnv.STRIPE_SECRET_KEY);
const metadata = {
  managed_by: STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
};

async function main() {
  const knownConfiguration =
    await findStripeBillingPortalConfiguration(stripe);

  if (knownConfiguration && knownConfiguration.livemode !== isLiveMode) {
    throw new Error("Stripe returned a configuration for the wrong mode.");
  }

  const configuration = knownConfiguration
    ? await stripe.billingPortal.configurations.update(knownConfiguration.id, {
        active: true,
        features: getStripeBillingPortalConfigurationFeatures(),
        metadata,
        name: STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
      })
    : await stripe.billingPortal.configurations.create({
        features: getStripeBillingPortalConfigurationFeatures(),
        metadata,
        name: STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
      });

  const mode = configuration.livemode ? "live" : "test";
  console.info(
    `Billing Portal configuration ${configuration.id} is ready for ${mode} mode.`,
  );
}

await main();
