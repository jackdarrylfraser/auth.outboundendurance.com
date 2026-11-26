import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, it } from "node:test";
import { role, user, userRole } from "@/lib/db/schema";
import { createRoleService } from "@/lib/role/service";

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
  await client.execute(`
    CREATE TABLE role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);
  await client.execute(`
    CREATE TABLE user_role (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES role(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, role_id)
    )
  `);

  const [savedUser] = await database
    .insert(user)
    .values({
      name: "Test User",
      email: "user@example.test",
      emailVerified: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })
    .returning({ id: user.id });

  assert.ok(savedUser);

  return {
    client,
    database,
    userId: String(savedUser.id),
    service: createRoleService({ database }),
  };
}

describe("role service", () => {
  it("recognizes an assigned role and rejects unassigned roles", async (t) => {
    const { client, userId, service } = await createService();
    t.after(() => client.close());

    await service.assignRole(userId, "admin");

    assert.equal(await service.hasRole(userId, "admin"), true);
    assert.equal(await service.hasRole(userId, "moderator"), false);
    assert.equal(await service.hasRole("999", "admin"), false);
    assert.equal(await service.hasRole("invalid", "admin"), false);
  });

  it("does not create duplicate roles or assignments when seeded repeatedly", async (t) => {
    const { client, database, userId, service } = await createService();
    t.after(() => client.close());

    await service.assignRole(userId, "admin");
    await service.assignRole(userId, "admin");

    const savedRoles = await database.select().from(role);
    const assignments = await database.select().from(userRole);

    assert.equal(savedRoles.length, 1);
    assert.equal(assignments.length, 1);
    assert.equal(await service.hasRole(userId, "admin"), true);
  });
});
