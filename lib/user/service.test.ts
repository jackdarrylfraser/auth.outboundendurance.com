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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  it("looks up a user by ID", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());
    const [savedUser] = await database.insert(user).values({
      name: "Test User",
      email: "user@example.test",
      emailVerified: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }).returning({ id: user.id });
    assert.ok(savedUser);

    assert.deepEqual(await service.getUserById(String(savedUser.id)), {
      id: savedUser.id,
      name: "Test User",
      email: "user@example.test",
    });
    assert.equal(await service.getUserById("not-a-number"), null);
  });

  it("creates an unverified user", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());

    const result = await service.getOrCreateUser({
      name: "Test User",
      email: "user@example.test",
    });
    const [savedUser] = await database
      .select({ emailVerified: user.emailVerified })
      .from(user);

    assert.equal(result.created, true);
    assert.ok(result.user.id > 0);
    assert.equal(result.user.name, "Test User");
    assert.equal(result.user.email, "user@example.test");
    assert.equal(savedUser?.emailVerified, false);
  });

  it("returns an existing user by email without overwriting their details", async (t) => {
    const { client, database, service } = await createService();
    t.after(() => client.close());
    const [existingUser] = await database.insert(user).values({
      name: "Original Name",
      email: "user@example.test",
      emailVerified: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }).returning({ id: user.id });
    assert.ok(existingUser);

    const result = await service.getOrCreateUser({
      name: "Updated Name",
      email: "user@example.test",
    });

    assert.deepEqual(result, {
      user: {
        id: existingUser.id,
        name: "Original Name",
        email: "user@example.test",
      },
      created: false,
    });
  });

  it("allows different users to share the same name", async (t) => {
    const { client, service } = await createService();
    t.after(() => client.close());

    const first = await service.getOrCreateUser({
      name: "Same Name",
      email: "first@example.test",
    });
    const second = await service.getOrCreateUser({
      name: "Same Name",
      email: "second@example.test",
    });

    assert.equal(first.created, true);
    assert.equal(second.created, true);
    assert.notEqual(first.user.id, second.user.id);
  });
});
