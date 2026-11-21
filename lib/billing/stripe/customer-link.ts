export function getVerifiedStripeCustomerUserId(customer: {
  metadata?: { userId?: string };
  deleted?: unknown;
}): string | null {
  if (customer.deleted === true || !customer.metadata?.userId) {
    return null;
  }

  return customer.metadata.userId;
}
