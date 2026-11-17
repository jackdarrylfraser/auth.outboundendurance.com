import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeEvent } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/stripe-webhook";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing Stripe signature." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeSignatureVerificationError ||
      error instanceof SyntaxError
    ) {
      return Response.json(
        { error: "Invalid Stripe webhook signature or payload." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    throw error;
  }

  await db
    .insert(stripeEvent)
    .values({
      id: event.id,
      type: event.type,
      eventCreatedAt: new Date(event.created * 1000),
      payload: JSON.stringify(event),
      processedAt: null,
    })
    .onConflictDoNothing({ target: stripeEvent.id });

  const [storedEvent] = await db
    .select({ processedAt: stripeEvent.processedAt })
    .from(stripeEvent)
    .where(eq(stripeEvent.id, event.id))
    .limit(1);

  if (storedEvent?.processedAt) {
    return Response.json({ received: true }, { headers: noStoreHeaders });
  }

  await processStripeWebhookEvent(event);

  return Response.json({ received: true }, { headers: noStoreHeaders });
}
