export type SubscriptionEntitlement = {
  status: string;
};

export type SubscriptionManagementState = {
  status: string;
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
): boolean {
  return subscriptions.some(({ status }) =>
    ["active", "trialing", "unpaid", "past_due", "paused"].includes(status),
  );
}
