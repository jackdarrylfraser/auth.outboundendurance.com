import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type Stripe from "stripe";
import { describe, it } from "node:test";
import { createStripeCustomerService } from "@/lib/billing/stripe/customer-service";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { stripeCustomer } from "@/lib/db/schema";

async function createService(
  beforeCreate?: (database: Infrastructure["db"]) => Promise<void>,
) {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client);
  await client.execute(`
    CREATE TABLE stripe_customer (
      user_id TEXT PRIMARY KEY NOT NULL,
      stripe_customer_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const createdCustomers: Array<{
    customer: Stripe.CustomerCreateParams;
    options: Stripe.RequestOptions;
  }> = [];
  const stripeCustomers: Parameters<
    typeof createStripeCustomerService
  >[0]["stripeCustomers"] = {
    async create(customer, options) {
      await beforeCreate?.(database);
      createdCustomers.push({ customer, options });
      return { id: `cus_${createdCustomers.length}` };
    },
  };
  const service = createStripeCustomerService({ database, stripeCustomers });

  return { client, database, service, createdCustomers };
}

describe("Stripe customer service", () => {
  it("looks up an existing customer mapping without creating a customer", async (t) => {
    const { client, database, service, createdCustomers } = await createService();
    t.after(() => client.close());
    await database.insert(stripeCustomer).values({
      userId: "user_123",
      stripeCustomerId: "cus_existing",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    assert.equal(await service.getStripeCustomerId("user_123"), "cus_existing");
    assert.equal(createdCustomers.length, 0);
  });

  it("creates and saves an idempotently mapped Stripe customer", async (t) => {
    const { client, service, createdCustomers } = await createService();
    t.after(() => client.close());
    const user = { id: "user_123", email: "user@example.com" };

    assert.equal(await service.getOrCreateStripeCustomer(user), "cus_1");
    assert.equal(await service.getOrCreateStripeCustomer(user), "cus_1");
    assert.deepEqual(createdCustomers, [
      {
        customer: {
          email: user.email,
          metadata: { userId: user.id },
        },
        options: {
          idempotencyKey: `outboundendurance-user-${createHash("sha256")
            .update(user.id)
            .digest("hex")}`,
        },
      },
    ]);
  });

  it("returns a concurrently saved mapping after a create conflict", async (t) => {
    const { client, service } = await createService(async (database) => {
      await database.insert(stripeCustomer).values({
        userId: "user_123",
        stripeCustomerId: "cus_concurrent",
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
    });
    t.after(() => client.close());

    assert.equal(
      await service.getOrCreateStripeCustomer({
        id: "user_123",
        email: "user@example.com",
      }),
      "cus_concurrent",
    );
  });
});
