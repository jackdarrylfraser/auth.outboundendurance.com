import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";
import { createStripeWebhookService } from "@/lib/billing/stripe/webhook-service";
import { infrastructure } from "@/lib/infrastructure/server";

export const stripeWebhookService = createStripeWebhookService({
  database: infrastructure.db,
  subscriptionService: stripeSubscriptionService,
});

export const { processStripeWebhookEvent } = stripeWebhookService;
