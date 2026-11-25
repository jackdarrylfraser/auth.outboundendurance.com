import { eq } from "drizzle-orm";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import {
  hasManageableSubscription,
  hasPaidEntitlement,
  PaidAccessRequiredError,
} from "@/lib/access/entitlement-policy";
import { infrastructure } from "@/lib/infrastructure/server";

export async function requirePaidAccess(userId: string): Promise<void> {
  const subscriptions = await infrastructure.db
    .select({ status: stripeSubscription.status })
    .from(stripeSubscription)
    .innerJoin(
      stripeCustomer,
      eq(stripeSubscription.stripeCustomerId, stripeCustomer.stripeCustomerId),
    )
    .where(eq(stripeCustomer.userId, userId));

  if (!hasPaidEntitlement(subscriptions)) {
    throw new PaidAccessRequiredError();
  }
}

export async function hasManageableStripeSubscription(
  userId: string,
): Promise<boolean> {
  const subscriptions = await infrastructure.db
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
