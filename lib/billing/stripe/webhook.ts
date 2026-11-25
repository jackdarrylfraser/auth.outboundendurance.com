import { db } from "@/lib/db";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";
import { createStripeWebhookService } from "@/lib/billing/stripe/webhook-service";

export const stripeWebhookService = createStripeWebhookService({
  database: db,
  subscriptionService: stripeSubscriptionService,
});

export const { processStripeWebhookEvent } = stripeWebhookService;
