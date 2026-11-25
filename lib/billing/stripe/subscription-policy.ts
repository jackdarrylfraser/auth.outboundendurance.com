export type StripeSubscriptionStateInput = {
  id: string;
  customer: string | { id: string };
  status: string;
  items: { data: Array<{ current_period_end: number }> };
  cancel_at_period_end: boolean;
  cancel_at: number | null;
};

export type SubscriptionSyncOptions = {
  eventCreatedAt?: Date;
  expectedLastEventCreatedAt?: Date;
};

export type SubscriptionSyncGuard =
  | { type: "event"; eventCreatedAt: Date }
  | { type: "freshness"; expectedLastEventCreatedAt: Date }
  | { type: "none" };

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

export function getSubscriptionSyncGuard(
  options: SubscriptionSyncOptions,
): SubscriptionSyncGuard {
  if (options.eventCreatedAt !== undefined) {
    return { type: "event", eventCreatedAt: options.eventCreatedAt };
  }
  if (options.expectedLastEventCreatedAt !== undefined) {
    return {
      type: "freshness",
      expectedLastEventCreatedAt: options.expectedLastEventCreatedAt,
    };
  }
  return { type: "none" };
}
