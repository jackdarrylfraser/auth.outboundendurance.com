import type Stripe from "stripe";
import { findStripeBillingPortalConfiguration } from "@/lib/billing/stripe/billing-portal-service";
import { infrastructure } from "@/lib/infrastructure/runtime";
import {
  getStripeBillingPortalConfigurationFeatures,
  STRIPE_CANCELLATION_FEEDBACK_OPTIONS,
  STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
} from "@/lib/billing/stripe/billing-portal-policy";
import { getStripeLivemode } from "@/lib/billing/stripe/catalog-definition";

const { env, stripe } = infrastructure;
const isLiveMode = getStripeLivemode(env.STRIPE_SECRET_KEY);
const metadata = {
  managed_by: STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
};

async function main() {
  const activeFeedbackOptions: Stripe.Billing.FeedbackOption[] = [];
  for await (const option of stripe.billing.feedbackOptions.list({
    limit: 100,
    status: "active",
  })) {
    activeFeedbackOptions.push(option);
  }

  const feedbackOptionIds = await Promise.all(
    STRIPE_CANCELLATION_FEEDBACK_OPTIONS.map(async (description) => {
      const matchingOptions = activeFeedbackOptions.filter(
        (option) =>
          option.description === description && option.livemode === isLiveMode,
      );

      if (matchingOptions.length > 1) {
        throw new Error(
          `Multiple active Stripe cancellation feedback options match "${description}".`,
        );
      }

      const option =
        matchingOptions[0] ??
        (await stripe.billing.feedbackOptions.create({ description }));

      if (option.livemode !== isLiveMode) {
        throw new Error(
          "Stripe returned a feedback option for the wrong mode.",
        );
      }

      return option.id;
    }),
  );
  const features =
    getStripeBillingPortalConfigurationFeatures(feedbackOptionIds);

  const knownConfiguration = await findStripeBillingPortalConfiguration(
    stripe.billingPortal,
  );

  if (knownConfiguration && knownConfiguration.livemode !== isLiveMode) {
    throw new Error("Stripe returned a configuration for the wrong mode.");
  }

  const configuration = knownConfiguration
    ? await stripe.billingPortal.configurations.update(knownConfiguration.id, {
        active: true,
        features,
        metadata,
        name: STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
      })
    : await stripe.billingPortal.configurations.create({
        features,
        metadata,
        name: STRIPE_BILLING_PORTAL_CONFIGURATION_NAME,
      });

  const mode = configuration.livemode ? "live" : "test";
  console.info(
    `Billing Portal configuration ${configuration.id} is ready for ${mode} mode.`,
  );
}

await main();
