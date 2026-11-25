import { eq } from "drizzle-orm";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import {
  hasManageableSubscription,
  hasPaidEntitlement,
  PaidAccessRequiredError,
} from "@/lib/access/entitlement-policy";
import { infrastructure } from "@/lib/infrastructure/server";
import { toDatabaseUserId } from "@/lib/user/id";

export async function requirePaidAccess(userId: string): Promise<void> {
  const subscriptions = await infrastructure.db
    .select({ status: stripeSubscription.status })
    .from(stripeSubscription)
    .innerJoin(
      stripeCustomer,
      eq(stripeSubscription.stripeCustomerId, stripeCustomer.stripeCustomerId),
    )
    .where(eq(stripeCustomer.userId, toDatabaseUserId(userId)));

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
    .where(eq(stripeCustomer.userId, toDatabaseUserId(userId)));

  return hasManageableSubscription(subscriptions, new Date());
}
