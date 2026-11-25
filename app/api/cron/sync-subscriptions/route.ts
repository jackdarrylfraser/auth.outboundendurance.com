import { and, asc, gt, lte } from "drizzle-orm";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";
import { stripeSubscription } from "@/lib/db/schema";
import { infrastructure } from "@/lib/infrastructure/server";

export const maxDuration = 30;

const noStoreHeaders = { "Cache-Control": "no-store" };
const batchSize = 10;
const stripeRequestTimeoutMs = 5_000;
const subscriptionFreshnessMs = 23 * 60 * 60 * 1000;
const processingBudgetMs = 20_000;

export async function GET(request: Request) {
  if (!infrastructure.env.CRON_SECRET) {
    return Response.json(
      { error: "Cron authentication is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${infrastructure.env.CRON_SECRET}`
  ) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const staleBefore = new Date(Date.now() - subscriptionFreshnessMs);
  const startedAt = Date.now();
  let cursor: number | undefined;
  let checked = 0;
  let synced = 0;
  const failures: string[] = [];
  let timeBudgetReached = false;

  while (true) {
    if (Date.now() - startedAt >= processingBudgetMs) {
      timeBudgetReached = true;
      break;
    }

    const staleSubscriptions = await infrastructure.db
      .select({
        id: stripeSubscription.id,
        stripeSubscriptionId: stripeSubscription.stripeSubscriptionId,
        lastEventCreatedAt: stripeSubscription.lastEventCreatedAt,
      })
      .from(stripeSubscription)
      .where(
        cursor
          ? and(
              lte(stripeSubscription.lastSyncedAt, staleBefore),
              gt(stripeSubscription.id, cursor),
            )
          : lte(stripeSubscription.lastSyncedAt, staleBefore),
      )
      .orderBy(asc(stripeSubscription.id))
      .limit(batchSize);

    if (staleSubscriptions.length === 0) {
      break;
    }

    for (const subscription of staleSubscriptions) {
      if (Date.now() - startedAt >= processingBudgetMs) {
        timeBudgetReached = true;
        break;
      }

      cursor = subscription.id;
      checked += 1;
      try {
        await stripeSubscriptionService.retrieveAndSyncSubscription(
          subscription.stripeSubscriptionId,
          {
            expectedLastEventCreatedAt: subscription.lastEventCreatedAt,
            requestOptions: {
              timeout: stripeRequestTimeoutMs,
              maxNetworkRetries: 0,
            },
          },
        );
        synced += 1;
      } catch (error) {
        failures.push(subscription.stripeSubscriptionId);
        infrastructure.logger.error(
          { subscriptionId: subscription.stripeSubscriptionId, err: error },
          "Subscription reconciliation failed.",
        );
      }
    }

    if (timeBudgetReached) {
      break;
    }
  }

  const remaining = failures.length > 0 || timeBudgetReached;
  return Response.json(
    {
      checked,
      synced,
      failed: failures.length,
      failedSubscriptionIds: failures,
      remaining,
      timeBudgetReached,
    },
    {
      status: remaining ? 500 : 200,
      headers: noStoreHeaders,
    },
  );
}
