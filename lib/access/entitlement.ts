import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import { hasManageableSubscription } from "@/lib/access/entitlement-policy";
import { createAccessService } from "@/lib/access/entitlement-service";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";

const accessService = createAccessService({
  loadSubscriptions: async (userId) =>
    db
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
      .where(eq(stripeCustomer.userId, userId)),
  subscriptionService: stripeSubscriptionService,
});

export const { requirePaidAccess } = accessService;

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
