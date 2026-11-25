import Stripe from "stripe";
import { env } from "@/lib/env";
import { getLogger } from "@/lib/logger";
import { processStripeWebhookEvent } from "@/lib/billing/stripe/webhook";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    getLogger().warn("Stripe webhook rejected: missing signature.");
    return Response.json(
      { error: "Missing Stripe signature." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    getLogger().error("Stripe webhook secret is not configured.");
    return Response.json(
      { error: "Stripe webhook is not configured." },
      { status: 500, headers: noStoreHeaders },
    );
  }

  const rawBody = await request.text();
  let verifiedEvent: Stripe.Event | undefined;

  try {
    verifiedEvent = await infrastructure.stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
    await processStripeWebhookEvent(verifiedEvent);
  } catch (error) {
    if (!verifiedEvent) {
      if (
        error instanceof Stripe.errors.StripeSignatureVerificationError ||
        error instanceof SyntaxError
      ) {
        getLogger().warn(
          { errorType: error.name },
          "Stripe webhook rejected: invalid signature or payload.",
        );
        return Response.json(
          { error: "Invalid Stripe webhook signature or payload." },
          { status: 400, headers: noStoreHeaders },
        );
      }

      getLogger().error(
        { err: error },
        "Stripe webhook signature verification failed.",
      );
      throw error;
    }

    getLogger().error(
      {
        eventId: verifiedEvent.id,
        eventType: verifiedEvent.type,
        err: error,
      },
      "Stripe webhook processing failed.",
    );
    throw error;
  }

  return Response.json({ received: true }, { headers: noStoreHeaders });
}
