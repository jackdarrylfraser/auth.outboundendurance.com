import { eq } from "drizzle-orm";
import { stripeCatalog } from "@/lib/db/schema";
import { getStripeLivemode } from "@/lib/billing/stripe/mode";
import { infrastructure } from "@/lib/infrastructure/server";

export type SubscriptionPlan = {
  priceId: string;
  name: string;
  description: string | null;
  unitAmount: number;
  currency: string;
  interval: string;
  intervalCount: number;
};

export async function getCurrentSubscriptionPlan(): Promise<SubscriptionPlan> {
  const { db, env } = infrastructure;
  const livemode = getStripeLivemode(env.STRIPE_SECRET_KEY);
  const [catalog] = await db
    .select()
    .from(stripeCatalog)
    .where(eq(stripeCatalog.livemode, livemode))
    .limit(1);

  if (!catalog) {
    throw new Error(
      `The Stripe ${livemode ? "live" : "test"} subscription catalog is not provisioned. Run \`bun run db:migrate && bun run stripe:catalog:sync\` before serving billing traffic.`,
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
