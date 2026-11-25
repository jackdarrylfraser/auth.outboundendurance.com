export type SubscriptionEntitlement = {
  status: string;
};

export type SubscriptionManagementState = {
  status: string;
  currentPeriodEnd: Date;
};

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

export function hasManageableSubscription(
  subscriptions: readonly SubscriptionManagementState[],
  now: Date,
): boolean {
  return subscriptions.some(({ status, currentPeriodEnd }) => {
    if (
      status === "active" ||
      status === "trialing" ||
      status === "unpaid" ||
      status === "past_due" ||
      status === "paused"
    ) {
      return true;
    }

    return (
      status === "canceled" &&
      currentPeriodEnd.getTime() > now.getTime()
    );
  });
}
