import { eq, lte } from "drizzle-orm";
import Stripe from "stripe";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { stripeCustomer, stripeSubscription, user } from "@/lib/db/schema";
import { getVerifiedStripeCustomerUserId } from "@/lib/billing/stripe/customer-link";
import {
  getSubscriptionSyncGuard,
  toStripeSubscriptionState,
  type StripeSubscriptionStateInput,
  type SubscriptionSyncOptions,
} from "@/lib/billing/stripe/subscription-policy";

export class UnlinkedStripeCustomerError extends Error {
  constructor(customerId: string) {
    super(`Stripe customer ${customerId} has no safely verified user mapping.`);
    this.name = "UnlinkedStripeCustomerError";
  }
}

export type StripeCustomerRetrievalOperations = {
  retrieve(
    customerId: string,
  ): Promise<{ metadata?: { userId?: string }; deleted?: unknown }>;
};

export type StripeSubscriptionRetrievalOperations = {
  retrieve(
    subscriptionId: string,
    params: Stripe.SubscriptionRetrieveParams,
    options?: Stripe.RequestOptions,
  ): Promise<StripeSubscriptionStateInput>;
};

export type RetrieveAndSyncOptions = SubscriptionSyncOptions & {
  requestOptions?: Stripe.RequestOptions;
};

export function createStripeSubscriptionService(dependencies: {
  database: Infrastructure["db"];
  stripeCustomers: StripeCustomerRetrievalOperations;
  stripeSubscriptions: StripeSubscriptionRetrievalOperations;
}) {
  async function ensureCustomerMapping(
    customerId: string,
    syncedAt: Date,
  ): Promise<void> {
    let [customerMapping] = await dependencies.database
      .select({ userId: stripeCustomer.userId })
      .from(stripeCustomer)
      .where(eq(stripeCustomer.stripeCustomerId, customerId))
      .limit(1);

    if (customerMapping) {
      return;
    }

    const customer = await dependencies.stripeCustomers.retrieve(customerId);
    const userId = getVerifiedStripeCustomerUserId(customer);

    if (!userId) {
      throw new UnlinkedStripeCustomerError(customerId);
    }

    const [existingUser] = await dependencies.database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!existingUser) {
      throw new UnlinkedStripeCustomerError(customerId);
    }

    await dependencies.database
      .insert(stripeCustomer)
      .values({
        userId,
        stripeCustomerId: customerId,
        createdAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoNothing();

    [customerMapping] = await dependencies.database
      .select({ userId: stripeCustomer.userId })
      .from(stripeCustomer)
      .where(eq(stripeCustomer.stripeCustomerId, customerId))
      .limit(1);

    if (!customerMapping || customerMapping.userId !== userId) {
      throw new UnlinkedStripeCustomerError(customerId);
    }
  }

  async function syncSubscription(
    subscription: StripeSubscriptionStateInput,
    options: SubscriptionSyncOptions = {},
  ): Promise<void> {
    const syncedAt = new Date();
    const state = toStripeSubscriptionState(subscription, syncedAt);
    await ensureCustomerMapping(state.stripeCustomerId, syncedAt);

    const guard = getSubscriptionSyncGuard(options);
    const setWhere =
      guard.type === "event"
        ? lte(stripeSubscription.lastEventCreatedAt, guard.eventCreatedAt)
        : guard.type === "freshness"
          ? eq(
              stripeSubscription.lastEventCreatedAt,
              guard.expectedLastEventCreatedAt,
            )
          : undefined;

    await dependencies.database
      .insert(stripeSubscription)
      .values({
        ...state,
        lastEventCreatedAt:
          guard.type === "event" ? guard.eventCreatedAt : new Date(0),
        createdAt: syncedAt,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: stripeSubscription.id,
        set: {
          stripeCustomerId: state.stripeCustomerId,
          status: state.status,
          currentPeriodEnd: state.currentPeriodEnd,
          cancelAtPeriodEnd: state.cancelAtPeriodEnd,
          cancelAt: state.cancelAt,
          lastSyncedAt: state.lastSyncedAt,
          updatedAt: syncedAt,
          ...(guard.type === "event"
            ? { lastEventCreatedAt: guard.eventCreatedAt }
            : {}),
        },
        ...(setWhere ? { setWhere } : {}),
      });
  }

  async function retrieveAndSyncSubscription(
    subscriptionId: string,
    options: RetrieveAndSyncOptions = {},
  ): Promise<void> {
    const subscription = await dependencies.stripeSubscriptions.retrieve(
      subscriptionId,
      {},
      options.requestOptions,
    );
    await syncSubscription(subscription, options);
  }

  return { syncSubscription, retrieveAndSyncSubscription };
}
