import { eq, lte } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { stripeCustomer, stripeSubscription, user } from "@/lib/db/schema";
import { stripe } from "@/lib/billing/stripe/client";
import { getVerifiedStripeCustomerUserId } from "@/lib/billing/stripe/customer-link";

export class UnlinkedStripeCustomerError extends Error {
  constructor(customerId: string) {
    super(`Stripe customer ${customerId} has no safely verified user mapping.`);
    this.name = "UnlinkedStripeCustomerError";
  }
}

type StripeSubscriptionStateInput = {
  id: string;
  customer: string | { id: string };
  status: string;
  items: { data: Array<{ current_period_end: number }> };
  cancel_at_period_end: boolean;
  cancel_at: number | null;
};

export function toStripeSubscriptionState(
  subscription: StripeSubscriptionStateInput,
  syncedAt: Date,
) {
  const periodEnds = subscription.items.data.map(
    (item) => item.current_period_end,
  );
  if (periodEnds.length === 0) {
    throw new Error(
      `Stripe subscription ${subscription.id} has no subscription items.`,
    );
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  return {
    id: subscription.id,
    stripeCustomerId: customerId,
    status: subscription.status,
    currentPeriodEnd: new Date(Math.max(...periodEnds) * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : null,
    lastSyncedAt: syncedAt,
  };
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  options: {
    eventCreatedAt?: Date;
    expectedLastEventCreatedAt?: Date;
  } = {},
): Promise<void> {
  const syncedAt = new Date();
  const state = toStripeSubscriptionState(subscription, syncedAt);
  let [customerMapping] = await db
    .select({ userId: stripeCustomer.userId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.stripeCustomerId, state.stripeCustomerId))
    .limit(1);

  if (!customerMapping) {
    const customer = await stripe.customers.retrieve(state.stripeCustomerId);
    const userId = getVerifiedStripeCustomerUserId(customer);

    if (!userId) {
      throw new UnlinkedStripeCustomerError(state.stripeCustomerId);
    }

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new UnlinkedStripeCustomerError(state.stripeCustomerId);
    }

    await db
      .insert(stripeCustomer)
      .values({
        userId,
        stripeCustomerId: state.stripeCustomerId,
        createdAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoNothing();

    [customerMapping] = await db
      .select({ userId: stripeCustomer.userId })
      .from(stripeCustomer)
      .where(eq(stripeCustomer.stripeCustomerId, state.stripeCustomerId))
      .limit(1);

    if (!customerMapping || customerMapping.userId !== userId) {
      throw new UnlinkedStripeCustomerError(state.stripeCustomerId);
    }
  }

  const eventCreatedAt = options.eventCreatedAt ?? new Date(0);
  const update = {
    stripeCustomerId: state.stripeCustomerId,
    status: state.status,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    cancelAt: state.cancelAt,
    lastSyncedAt: state.lastSyncedAt,
    updatedAt: syncedAt,
  };
  const setWhere = options.eventCreatedAt
    ? lte(stripeSubscription.lastEventCreatedAt, options.eventCreatedAt)
    : options.expectedLastEventCreatedAt
      ? eq(
          stripeSubscription.lastEventCreatedAt,
          options.expectedLastEventCreatedAt,
        )
      : undefined;

  await db
    .insert(stripeSubscription)
    .values({
      ...state,
      lastEventCreatedAt: eventCreatedAt,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    })
    .onConflictDoUpdate({
      target: stripeSubscription.id,
      set: {
        ...update,
        ...(options.eventCreatedAt
          ? { lastEventCreatedAt: options.eventCreatedAt }
          : {}),
      },
      ...(setWhere ? { setWhere } : {}),
    });
}
