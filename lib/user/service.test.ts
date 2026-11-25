import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, it } from "node:test";
import { createUserService } from "@/lib/user/service";
import { user } from "@/lib/db/schema";

async function createService() {
  const client = createClient({ url: "file::memory:" });
  const database = drizzle(client);
  await client.execute(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  return {
    client,
    database,
    service: createUserService({ database }),
  };
}

describe("user service", () => {
  it("creates an unverified user", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());

    const result = await service.getOrCreateUser({
      id: "user_123",
      name: "Test User",
      email: "user@example.test",
    });
    const [savedUser] = await database
      .select({ emailVerified: user.emailVerified })
      .from(user);

    assert.deepEqual(result, {
      user: {
        id: "user_123",
        name: "Test User",
        email: "user@example.test",
      },
      created: true,
    });
    assert.equal(savedUser?.emailVerified, false);
  });

  it("returns an existing user without overwriting their details", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());
    await database.insert(user).values({
      id: "user_123",
      name: "Original Name",
      email: "user@example.test",
      emailVerified: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const result = await service.getOrCreateUser({
      id: "user_123",
      name: "Updated Name",
      email: "user@example.test",
    });

    assert.deepEqual(result, {
      user: {
        id: "user_123",
        name: "Original Name",
        email: "user@example.test",
      },
      created: false,
    });
  });

  it("rejects an email already assigned to another user", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());
    await database.insert(user).values({
      id: "user_123",
      name: "Existing User",
      email: "user@example.test",
      emailVerified: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await assert.rejects(
      service.getOrCreateUser({
        id: "user_456",
        name: "Different User",
        email: "user@example.test",
      }),
      /belongs to another user/,
    );
  });
});
