import { eq } from "drizzle-orm";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import {
  hasManageableSubscription,
  hasPaidEntitlement,
  PaidAccessRequiredError,
} from "@/lib/access/entitlement-policy";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";
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
  const stripeSubscriptions = await getStripeSubscriptions(userId);
  return hasManageableSubscription(
    stripeSubscriptions.map(({ status }) => ({ status })),
  );
}

export async function hasPaidStripeSubscription(
  userId: string,
): Promise<boolean> {
  const stripeSubscriptions = await getStripeSubscriptions(userId);
  return hasPaidEntitlement(
    stripeSubscriptions.map(({ status }) => ({ status })),
  );
}

async function getStripeSubscriptions(userId: string) {
  const customerId = await stripeCustomerService.getStripeCustomerId(userId);
  if (!customerId) {
    return [];
  }

  const subscriptions = await infrastructure.stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  if (subscriptions.has_more) {
    throw new Error(
      "Unable to safely verify this account because it has more than 100 Stripe subscriptions.",
    );
  }

  await Promise.all(
    subscriptions.data.map((subscription) =>
      stripeSubscriptionService.syncSubscription(subscription),
    ),
  );

  return subscriptions.data;
}
