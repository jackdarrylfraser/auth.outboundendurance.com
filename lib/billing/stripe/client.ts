import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { stripeCustomer } from "@/lib/db/schema";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const [mapping] = await db
    .select({ customerId: stripeCustomer.stripeCustomerId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, userId))
    .limit(1);

  return mapping?.customerId ?? null;
}

export async function getOrCreateStripeCustomer(user: {
  id: string;
  email: string;
}): Promise<string> {
  const [mapping] = await db
    .select({ customerId: stripeCustomer.stripeCustomerId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, user.id))
    .limit(1);

  if (mapping) {
    return mapping.customerId;
  }

  const userKey = createHash("sha256").update(user.id).digest("hex");
  const customer = await stripe.customers.create(
    {
      email: user.email,
      metadata: { userId: user.id },
    },
    { idempotencyKey: `outboundendurance-user-${userKey}` },
  );

  const now = new Date();
  await db
    .insert(stripeCustomer)
    .values({
      userId: user.id,
      stripeCustomerId: customer.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: stripeCustomer.userId });

  const [savedMapping] = await db
    .select({ customerId: stripeCustomer.stripeCustomerId })
    .from(stripeCustomer)
    .where(eq(stripeCustomer.userId, user.id))
    .limit(1);

  if (!savedMapping) {
    throw new Error("Stripe customer mapping was not saved.");
  }

  return savedMapping.customerId;
}
