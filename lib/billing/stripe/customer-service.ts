import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { stripeCustomer } from "@/lib/db/schema";

export type StripeCustomerOperations = {
  create(
    customer: Stripe.CustomerCreateParams,
    options: Stripe.RequestOptions,
  ): Promise<Pick<Stripe.Customer, "id">>;
};

export function createStripeCustomerService(dependencies: {
  database: Infrastructure["db"];
  stripeCustomers: StripeCustomerOperations;
}) {
  async function getStripeCustomerId(userId: string): Promise<string | null> {
    const [mapping] = await dependencies.database
      .select({ customerId: stripeCustomer.stripeCustomerId })
      .from(stripeCustomer)
      .where(eq(stripeCustomer.userId, userId))
      .limit(1);

    return mapping?.customerId ?? null;
  }

  async function getOrCreateStripeCustomer(user: {
    id: string;
    email: string;
  }): Promise<string> {
    const existingCustomerId = await getStripeCustomerId(user.id);
    if (existingCustomerId) {
      return existingCustomerId;
    }

    const userKey = createHash("sha256").update(user.id).digest("hex");
    const customer = await dependencies.stripeCustomers.create(
      {
        email: user.email,
        metadata: { userId: user.id },
      },
      { idempotencyKey: `outboundendurance-user-${userKey}` },
    );

    const now = new Date();
    await dependencies.database
      .insert(stripeCustomer)
      .values({
        userId: user.id,
        stripeCustomerId: customer.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: stripeCustomer.userId });

    const savedCustomerId = await getStripeCustomerId(user.id);
    if (!savedCustomerId) {
      throw new Error("Stripe customer mapping was not saved.");
    }

    return savedCustomerId;
  }

  return { getStripeCustomerId, getOrCreateStripeCustomer };
}
