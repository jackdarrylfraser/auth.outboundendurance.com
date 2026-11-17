export type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getId(value: unknown): string | null {
  if (typeof value === "string") {
    return value || null;
  }

  if (isRecord(value) && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

export function getStripeSubscriptionId(
  event: StripeWebhookEvent,
): string | null {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    if (!isRecord(event.data.object)) {
      return null;
    }

    return getId(event.data.object.subscription);
  }

  if (event.type.startsWith("customer.subscription.")) {
    return getId(event.data.object);
  }

  return null;
}
