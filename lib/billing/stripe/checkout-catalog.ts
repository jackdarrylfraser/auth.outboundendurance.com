import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { stripeCatalog } from "@/lib/db/schema";
import { getStripeLivemode } from "@/lib/billing/stripe/catalog-definition";
import type { CheckoutPlan } from "@/lib/billing/stripe/checkout";

export async function getCurrentCheckoutPlan(): Promise<CheckoutPlan> {
  const livemode = getStripeLivemode(env.STRIPE_SECRET_KEY);
  const [catalog] = await db
    .select()
    .from(stripeCatalog)
    .where(eq(stripeCatalog.livemode, livemode))
    .limit(1);

  if (!catalog) {
    throw new Error(
      `The Stripe ${livemode ? "live" : "test"} subscription catalog is not synchronized. Run \`bun run stripe:catalog:sync\` before deploying.`,
    );
  }

  return {
    priceId: catalog.stripePriceId,
    name: catalog.name,
    description: catalog.description,
    unitAmount: catalog.unitAmount,
    currency: catalog.currency,
    interval: catalog.interval,
    intervalCount: catalog.intervalCount,
  };
}
