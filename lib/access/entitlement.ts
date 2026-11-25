import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import {
  createPaidAccessGuard,
  hasManageableSubscription,
  isSubscriptionStale,
} from "@/lib/access/entitlement-policy";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";

export const requirePaidAccess = createPaidAccessGuard(async (userId) => {
  const subscriptions = await loadSubscriptions(userId);
  const now = new Date();
  const staleEligibleSubscriptions = subscriptions.filter(
    ({ status, lastSyncedAt }) =>
      (status === "active" || status === "trialing") &&
      isSubscriptionStale(lastSyncedAt, now),
  );

  if (staleEligibleSubscriptions.length > 0) {
    for (const subscription of staleEligibleSubscriptions) {
      await stripeSubscriptionService.retrieveAndSyncSubscription(
        subscription.id,
        {
        expectedLastEventCreatedAt: subscription.lastEventCreatedAt,
        },
      );
    }

    return loadSubscriptions(userId);
  }

  return subscriptions;
});

export async function hasManageableStripeSubscription(
  userId: string,
): Promise<boolean> {
  const subscriptions = await db
    .select({
      status: stripeSubscription.status,
      currentPeriodEnd: stripeSubscription.currentPeriodEnd,
    })
    .from(stripeSubscription)
    .innerJoin(
      stripeCustomer,
      eq(stripeSubscription.stripeCustomerId, stripeCustomer.stripeCustomerId),
    )
    .where(eq(stripeCustomer.userId, userId));

  return hasManageableSubscription(subscriptions, new Date());
}

async function loadSubscriptions(userId: string) {
  return db
    .select({
      id: stripeSubscription.id,
      status: stripeSubscription.status,
      cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
      lastSyncedAt: stripeSubscription.lastSyncedAt,
      lastEventCreatedAt: stripeSubscription.lastEventCreatedAt,
    })
    .from(stripeSubscription)
    .innerJoin(
      stripeCustomer,
      eq(stripeSubscription.stripeCustomerId, stripeCustomer.stripeCustomerId),
    )
    .where(eq(stripeCustomer.userId, userId));
}
