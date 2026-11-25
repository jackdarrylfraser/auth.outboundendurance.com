import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, it } from "node:test";
import { stripeEvent } from "@/lib/db/schema";
import { createStripeWebhookService } from "@/lib/billing/stripe/webhook-service";
import type { StripeWebhookEvent } from "@/lib/billing/stripe/webhook-policy";

const event: StripeWebhookEvent = {
  id: "evt_123",
  type: "customer.subscription.updated",
  created: 1_800_000_000,
  data: { object: { id: "sub_123" } },
};

async function createService() {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client);
  await client.execute(`
    CREATE TABLE stripe_event (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      event_created_at INTEGER NOT NULL,
      payload TEXT,
      processed_at INTEGER
    )
  `);

  const syncCalls: Array<{
    subscriptionId: string;
    options: { eventCreatedAt: Date };
  }> = [];
  const service = createStripeWebhookService({
    database,
    subscriptionService: {
      async retrieveAndSyncSubscription(subscriptionId, options) {
        syncCalls.push({ subscriptionId, options });
      },
    },
  });

  return { client, database, service, syncCalls };
}

describe("Stripe webhook service", () => {
  it("persists, synchronizes, and marks a verified event processed", async (t) => {
    const { client, database, service, syncCalls } = await createService();
    t.after(() => client.close());

    const alreadyProcessed =
      await service.processStripeWebhookEvent(event);

    assert.equal(alreadyProcessed, false);
    assert.deepEqual(syncCalls, [
      {
        subscriptionId: "sub_123",
        options: { eventCreatedAt: new Date(event.created * 1000) },
      },
    ]);
    const [storedEvent] = await database
      .select()
      .from(stripeEvent)
      .where(eq(stripeEvent.id, event.id));
    assert.equal(storedEvent?.type, event.type);
    assert.equal(
      storedEvent?.eventCreatedAt.getTime(),
      event.created * 1000,
    );
    assert.ok(storedEvent?.payload);
    assert.ok(storedEvent?.processedAt);
  });

  it("does not repeat processing for a duplicate completed event", async (t) => {
    const { client, service, syncCalls } = await createService();
    t.after(() => client.close());
    await service.processStripeWebhookEvent(event);
    syncCalls.length = 0;

    const alreadyProcessed =
      await service.processStripeWebhookEvent(event);

    assert.equal(alreadyProcessed, true);
    assert.deepEqual(syncCalls, []);
  });

  it("marks events without subscriptions processed", async (t) => {
    const { client, database, service, syncCalls } = await createService();
    t.after(() => client.close());
    const nonSubscriptionEvent = {
      ...event,
      id: "evt_customer",
      type: "customer.updated",
      data: { object: { id: "cus_123" } },
    };

    await service.processStripeWebhookEvent(nonSubscriptionEvent);

    assert.deepEqual(syncCalls, []);
    const [storedEvent] = await database
      .select()
      .from(stripeEvent)
      .where(eq(stripeEvent.id, nonSubscriptionEvent.id));
    assert.ok(storedEvent?.processedAt);
  });

  it("leaves a failed event unprocessed so Stripe can retry it", async (t) => {
    const { client, database } = await createService();
    t.after(() => client.close());
    const service = createStripeWebhookService({
      database,
      subscriptionService: {
        async retrieveAndSyncSubscription() {
          throw new Error("Stripe unavailable");
        },
      },
    });

    await assert.rejects(service.processStripeWebhookEvent(event), /Stripe unavailable/);
    const [storedEvent] = await database
      .select()
      .from(stripeEvent)
      .where(eq(stripeEvent.id, event.id));
    assert.equal(storedEvent?.processedAt, null);
  });
});
