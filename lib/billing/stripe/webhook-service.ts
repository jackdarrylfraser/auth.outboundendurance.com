import { eq } from "drizzle-orm";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { stripeEvent } from "@/lib/db/schema";
import {
  getStripeSubscriptionId,
  type StripeWebhookEvent,
} from "@/lib/billing/stripe/webhook-policy";

type StripeSubscriptionService = {
  retrieveAndSyncSubscription(
    subscriptionId: string,
    options: { eventCreatedAt: Date },
  ): Promise<void>;
};

export function createStripeWebhookService(dependencies: {
  database: Infrastructure["db"];
  subscriptionService: StripeSubscriptionService;
}) {
  async function processStripeWebhookEvent(
    event: StripeWebhookEvent,
  ): Promise<boolean> {
    await dependencies.database
      .insert(stripeEvent)
      .values({
        id: event.id,
        type: event.type,
        eventCreatedAt: new Date(event.created * 1000),
        payload: JSON.stringify(event),
        processedAt: null,
      })
      .onConflictDoNothing({ target: stripeEvent.id });

    const [storedEvent] = await dependencies.database
      .select({ processedAt: stripeEvent.processedAt })
      .from(stripeEvent)
      .where(eq(stripeEvent.id, event.id))
      .limit(1);

    if (storedEvent?.processedAt) {
      return true;
    }

    const subscriptionId = getStripeSubscriptionId(event);
    if (subscriptionId) {
      await dependencies.subscriptionService.retrieveAndSyncSubscription(
        subscriptionId,
        { eventCreatedAt: new Date(event.created * 1000) },
      );
    }

    await dependencies.database
      .update(stripeEvent)
      .set({ processedAt: new Date() })
      .where(eq(stripeEvent.id, event.id));

    return false;
  }

  return { processStripeWebhookEvent };
}
