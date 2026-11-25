import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { describe, it } from "node:test";
import {
  getSubscriptionSyncGuard,
  toStripeSubscriptionState,
} from "@/lib/billing/stripe/subscription-policy";
import {
  createStripeSubscriptionService,
  UnlinkedStripeCustomerError,
  type StripeSubscriptionRetrievalOperations,
} from "@/lib/billing/stripe/subscription-service";
import { stripeCustomer, stripeSubscription } from "@/lib/db/schema";
import type { Infrastructure } from "@/lib/infrastructure/types";

const subscription = {
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  items: { data: [{ current_period_end: 1_800_000_000 }] },
  cancel_at_period_end: false,
  cancel_at: null,
};

async function createDatabase() {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client);
  await client.executeMultiple(`
    CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE stripe_customer (
      user_id TEXT PRIMARY KEY NOT NULL,
      stripe_customer_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE stripe_subscription (
      id TEXT PRIMARY KEY NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER NOT NULL,
      last_event_created_at INTEGER NOT NULL DEFAULT 0,
      last_synced_at INTEGER NOT NULL DEFAULT 0,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      cancel_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  await client.execute("INSERT INTO user (id) VALUES ('user_123')");
  await database.insert(stripeCustomer).values({
    userId: "user_123",
    stripeCustomerId: "cus_123",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });
  return { client, database };
}

function createService(
  database: Infrastructure["db"],
  customerMetadata: { userId?: string } | undefined = { userId: "user_123" },
  retrieveSubscription: StripeSubscriptionRetrievalOperations["retrieve"] =
    async () => subscription,
) {
  const customerLookups: string[] = [];
  const service = createStripeSubscriptionService({
    database,
    stripeCustomers: {
      async retrieve(customerId) {
        customerLookups.push(customerId);
        return { metadata: customerMetadata };
      },
    },
    stripeSubscriptions: { retrieve: retrieveSubscription },
  });
  return { service, customerLookups };
}

describe("Stripe subscription policy", () => {
  it("converts Stripe subscription values without infrastructure access", () => {
    assert.deepEqual(
      toStripeSubscriptionState(
        {
          ...subscription,
          customer: { id: "cus_456" },
          items: {
            data: [
              { current_period_end: 1_700_000_000 },
              { current_period_end: 1_800_000_000 },
            ],
          },
          cancel_at_period_end: true,
          cancel_at: 1_750_000_000,
        },
        new Date(1234),
      ),
      {
        id: "sub_123",
        stripeCustomerId: "cus_456",
        status: "active",
        currentPeriodEnd: new Date(1_800_000_000_000),
        cancelAtPeriodEnd: true,
        cancelAt: new Date(1_750_000_000_000),
        lastSyncedAt: new Date(1234),
      },
    );
  });

  it("prioritizes webhook event ordering over freshness checks", () => {
    const eventCreatedAt = new Date(1000);
    const expectedLastEventCreatedAt = new Date(500);

    assert.deepEqual(
      getSubscriptionSyncGuard({
        eventCreatedAt,
        expectedLastEventCreatedAt,
      }),
      { type: "event", eventCreatedAt },
    );
    assert.deepEqual(getSubscriptionSyncGuard({ expectedLastEventCreatedAt }), {
      type: "freshness",
      expectedLastEventCreatedAt,
    });
    assert.deepEqual(getSubscriptionSyncGuard({}), { type: "none" });
  });

  it("rejects subscriptions with no items", () => {
    assert.throws(
      () =>
        toStripeSubscriptionState(
          { ...subscription, items: { data: [] } },
          new Date(),
        ),
      /has no subscription items/,
    );
  });
});

describe("Stripe subscription service", () => {
  it("retrieves and synchronizes a subscription using injected operations", async (t) => {
    const { client, database } = await createDatabase();
    t.after(() => client.close());
    const calls: unknown[][] = [];
    const retrieveSubscription: StripeSubscriptionRetrievalOperations["retrieve"] =
      async (...args) => {
        calls.push(args);
        return subscription;
      };
    const { service, customerLookups } = createService(
      database,
      undefined,
      retrieveSubscription,
    );
    const eventCreatedAt = new Date(1_700_000_000_000);
    const requestOptions = { timeout: 5000, maxNetworkRetries: 0 };

    await service.retrieveAndSyncSubscription("sub_123", {
      eventCreatedAt,
      requestOptions,
    });

    assert.deepEqual(calls, [["sub_123", {}, requestOptions]]);
    assert.deepEqual(customerLookups, []);
    const [saved] = await database
      .select()
      .from(stripeSubscription)
      .where(eq(stripeSubscription.id, "sub_123"));
    assert.equal(saved?.status, "active");
    assert.equal(saved?.lastEventCreatedAt.getTime(), eventCreatedAt.getTime());
  });

  it("verifies and saves a customer mapping when synchronizing", async (t) => {
    const { client, database } = await createDatabase();
    t.after(() => client.close());
    await database
      .delete(stripeCustomer)
      .where(eq(stripeCustomer.userId, "user_123"));
    const { service, customerLookups } = createService(database);

    await service.syncSubscription(subscription);

    assert.deepEqual(customerLookups, ["cus_123"]);
    const [mapping] = await database
      .select()
      .from(stripeCustomer)
      .where(eq(stripeCustomer.stripeCustomerId, "cus_123"));
    assert.equal(mapping?.userId, "user_123");
  });

  it("rejects an unverified or nonexistent customer user mapping", async (t) => {
    const { client, database } = await createDatabase();
    t.after(() => client.close());
    await database
      .delete(stripeCustomer)
      .where(eq(stripeCustomer.userId, "user_123"));
    const { service } = createService(database, { userId: "unknown_user" });

    await assert.rejects(
      service.syncSubscription(subscription),
      UnlinkedStripeCustomerError,
    );
    assert.equal((await database.select().from(stripeCustomer)).length, 0);
  });

  it("does not overwrite a newer webhook event during stale refresh", async (t) => {
    const { client, database } = await createDatabase();
    t.after(() => client.close());
    await database.insert(stripeSubscription).values({
      ...toStripeSubscriptionState(subscription, new Date(1000)),
      lastEventCreatedAt: new Date(2000),
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    });
    const { service } = createService(database);

    await service.syncSubscription(
      { ...subscription, status: "canceled" },
      { expectedLastEventCreatedAt: new Date(1000) },
    );

    const [saved] = await database
      .select()
      .from(stripeSubscription)
      .where(eq(stripeSubscription.id, "sub_123"));
    assert.equal(saved?.status, "active");
    assert.equal(saved?.lastEventCreatedAt.getTime(), 2000);
  });

  it("ignores an out-of-order webhook event", async (t) => {
    const { client, database } = await createDatabase();
    t.after(() => client.close());
    await database.insert(stripeSubscription).values({
      ...toStripeSubscriptionState(subscription, new Date(1000)),
      lastEventCreatedAt: new Date(2000),
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    });
    const { service } = createService(database);

    await service.syncSubscription(
      { ...subscription, status: "canceled" },
      { eventCreatedAt: new Date(1000) },
    );

    const [saved] = await database
      .select()
      .from(stripeSubscription)
      .where(eq(stripeSubscription.id, "sub_123"));
    assert.equal(saved?.status, "active");
    assert.equal(saved?.lastEventCreatedAt.getTime(), 2000);
  });
});
