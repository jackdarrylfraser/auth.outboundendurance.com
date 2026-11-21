import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeEvent } from "@/lib/db/schema";
import { stripe } from "@/lib/billing/stripe/client";
import { syncStripeSubscription } from "@/lib/billing/stripe/subscriptions";
import {
  getStripeSubscriptionId,
  type StripeWebhookEvent,
} from "@/lib/billing/stripe/webhook-policy";

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent,
): Promise<void> {
  const subscriptionId = getStripeSubscriptionId(event);

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(subscription, {
      eventCreatedAt: new Date(event.created * 1000),
    });
  }

  await db
    .update(stripeEvent)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvent.id, event.id));
}
