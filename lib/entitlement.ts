import { eq } from "drizzle-orm";
import { db } from "./db";
import { stripeCustomer, stripeSubscription } from "./db/schema";
import { createPaidAccessGuard } from "./entitlement-policy";

export const requirePaidAccess = createPaidAccessGuard(async (userId) => {
  const subscriptions = await db
    .select({
      status: stripeSubscription.status,
      cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
    })
    .from(stripeSubscription)
    .innerJoin(
      stripeCustomer,
      eq(stripeSubscription.stripeCustomerId, stripeCustomer.stripeCustomerId),
    )
    .where(eq(stripeCustomer.userId, userId));

  return subscriptions;
});
