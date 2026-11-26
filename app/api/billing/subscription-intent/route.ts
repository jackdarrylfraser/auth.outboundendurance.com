import { getServerSession } from "@/lib/auth/session";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { getSubscriptionPaymentClientSecret } from "@/lib/billing/stripe/payment-element";
import { createStripePaymentElementService } from "@/lib/billing/stripe/payment-element";
import { getCurrentSubscriptionPlan } from "@/lib/billing/stripe/subscription-catalog";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };
const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const paymentElementService = createStripePaymentElementService({
  subscriptions: infrastructure.stripe.subscriptions,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPaidAccessRequired(error: unknown): boolean {
  if (error instanceof PaidAccessRequiredError) {
    return false;
  }
  throw error;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const hasPaidAccess = await requirePaidAccess(session.user.id).then(
      () => true,
      isPaidAccessRequired,
    );
    if (hasPaidAccess) {
      return Response.json(
        { error: "This account already has paid access." },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const body: unknown = await request.json();
    if (
      !isRecord(body) ||
      typeof body.idempotencyKey !== "string" ||
      !idempotencyKeyPattern.test(body.idempotencyKey)
    ) {
      return Response.json(
        { error: "A valid payment request key is required." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const plan = await getCurrentSubscriptionPlan();
    const customerId = await stripeCustomerService.getOrCreateStripeCustomer({
      id: session.user.id,
      email: session.user.email,
    });
    const existingSubscriptions =
      await infrastructure.stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });

    if (existingSubscriptions.has_more) {
      return Response.json(
        {
          error:
            "We couldn't safely verify your existing subscriptions. Please contact support.",
        },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const existingSubscription = existingSubscriptions.data.find(
      (subscription) =>
        subscription.status !== "canceled" &&
        subscription.status !== "incomplete_expired",
    );

    if (existingSubscription) {
      const isRetryableInlineSubscription =
        existingSubscription.status === "incomplete" &&
        existingSubscription.metadata.userId === session.user.id &&
        existingSubscription.metadata.payment_flow === "payment_element" &&
        existingSubscription.items.data.some(
          (item) => item.price.id === plan.priceId,
        );

      if (isRetryableInlineSubscription) {
        const subscription =
          await infrastructure.stripe.subscriptions.retrieve(
            existingSubscription.id,
            { expand: ["latest_invoice.confirmation_secret"] },
          );
        const clientSecret = getSubscriptionPaymentClientSecret(
          subscription.latest_invoice,
        );
        if (clientSecret) {
          return Response.json(
            { clientSecret },
            { headers: noStoreHeaders },
          );
        }
      }

      return Response.json(
        {
          error:
            "A subscription is already in progress or needs attention. Please manage your existing subscription.",
        },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const clientSecret = await paymentElementService.createSubscription({
      customerId,
      userId: session.user.id,
      priceId: plan.priceId,
      idempotencyKey: body.idempotencyKey,
    });

    return Response.json({ clientSecret }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    throw error;
  }
}
