import {
  createPaidAccessGuard,
  isSubscriptionStale,
  type SubscriptionEntitlement,
} from "@/lib/access/entitlement-policy";

export type AccessSubscription = SubscriptionEntitlement & {
  id: string;
  lastSyncedAt: Date;
  lastEventCreatedAt: Date;
};

type SubscriptionSynchronizationService = {
  retrieveAndSyncSubscription(
    subscriptionId: string,
    options: { expectedLastEventCreatedAt: Date },
  ): Promise<void>;
};

export function createAccessService(dependencies: {
  loadSubscriptions(userId: string): Promise<readonly AccessSubscription[]>;
  subscriptionService: SubscriptionSynchronizationService;
  getNow?: () => Date;
}) {
  const loadSubscriptionsWithRefresh = async (
    userId: string,
  ): Promise<readonly AccessSubscription[]> => {
    let subscriptions = await dependencies.loadSubscriptions(userId);
    const now = dependencies.getNow?.() ?? new Date();
    const staleEligibleSubscriptions = subscriptions.filter(
      ({ status, lastSyncedAt }) =>
        (status === "active" || status === "trialing") &&
        isSubscriptionStale(lastSyncedAt, now),
    );

    for (const subscription of staleEligibleSubscriptions) {
      await dependencies.subscriptionService.retrieveAndSyncSubscription(
        subscription.id,
        {
          expectedLastEventCreatedAt: subscription.lastEventCreatedAt,
        },
      );
    }

    if (staleEligibleSubscriptions.length > 0) {
      subscriptions = await dependencies.loadSubscriptions(userId);
    }

    return subscriptions;
  };

  return {
    requirePaidAccess: createPaidAccessGuard(loadSubscriptionsWithRefresh),
  };
}
