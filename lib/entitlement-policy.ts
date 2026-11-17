export type SubscriptionEntitlement = {
  status: string;
  cancelAtPeriodEnd: boolean;
};

export type SubscriptionLoader = (
  userId: string,
) => Promise<readonly SubscriptionEntitlement[]>;

export class PaidAccessRequiredError extends Error {
  constructor() {
    super("An active or trialing subscription is required.");
    this.name = "PaidAccessRequiredError";
  }
}

export function hasPaidEntitlement(
  subscriptions: readonly SubscriptionEntitlement[],
): boolean {
  return subscriptions.some(
    ({ status }) => status === "active" || status === "trialing",
  );
}

export function createPaidAccessGuard(loadSubscriptions: SubscriptionLoader) {
  return async function requirePaidAccess(userId: string): Promise<void> {
    const subscriptions = await loadSubscriptions(userId);
    if (!hasPaidEntitlement(subscriptions)) {
      throw new PaidAccessRequiredError();
    }
  };
}
