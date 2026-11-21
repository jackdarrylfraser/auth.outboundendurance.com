import { asc, lte } from "drizzle-orm";
import { env } from "@/lib/env";
import { stripe } from "@/lib/billing/stripe/client";
import { syncStripeSubscription } from "@/lib/billing/stripe/subscriptions";
import { db } from "@/lib/db";
import { stripeSubscription } from "@/lib/db/schema";

export const maxDuration = 30;

const noStoreHeaders = { "Cache-Control": "no-store" };
const batchSize = 10;
const stripeRequestTimeoutMs = 5_000;
const subscriptionFreshnessMs = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return Response.json(
      { error: "Cron authentication is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const staleBefore = new Date(Date.now() - subscriptionFreshnessMs);
  const staleSubscriptions = await db
    .select({
      id: stripeSubscription.id,
      lastEventCreatedAt: stripeSubscription.lastEventCreatedAt,
    })
    .from(stripeSubscription)
    .where(lte(stripeSubscription.lastSyncedAt, staleBefore))
    .orderBy(asc(stripeSubscription.lastSyncedAt))
    .limit(batchSize);

  let synced = 0;
  const failures: string[] = [];

  for (const subscription of staleSubscriptions) {
    try {
        const current = await stripe.subscriptions.retrieve(
          subscription.id,
          {},
          { timeout: stripeRequestTimeoutMs, maxNetworkRetries: 0 },
        );
        await syncStripeSubscription(current, {
          expectedLastEventCreatedAt: subscription.lastEventCreatedAt,
        });
      synced += 1;
    } catch (error) {
      failures.push(subscription.id);
      console.error("Subscription reconciliation failed.", {
        subscriptionId: subscription.id,
        error,
      });
    }
  }

  return Response.json(
    {
      checked: staleSubscriptions.length,
      synced,
      failed: failures.length,
      failedSubscriptionIds: failures,
    },
    {
      status: failures.length > 0 ? 500 : 200,
      headers: noStoreHeaders,
    },
  );
}
