import { parseDatabaseUserId } from "@/lib/user/id";

export function getVerifiedStripeCustomerUserId(customer: {
  metadata?: { userId?: string };
  deleted?: unknown;
}): string | null {
  if (customer.deleted === true || !customer.metadata?.userId) {
    return null;
  }

  return parseDatabaseUserId(customer.metadata.userId) === null
    ? null
    : customer.metadata.userId;
}
