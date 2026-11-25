import { eq } from "drizzle-orm";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { user } from "@/lib/db/schema";
import { parseDatabaseUserId } from "@/lib/user/id";

type UserIdentity = Pick<typeof user.$inferSelect, "id" | "name" | "email">;

export function createUserService(dependencies: {
  database: Infrastructure["db"];
}) {
  async function getUserById(id: string): Promise<UserIdentity | null> {
    const databaseId = parseDatabaseUserId(id);
    if (databaseId === null) {
      return null;
    }

    const [foundUser] = await dependencies.database
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, databaseId))
      .limit(1);

    return foundUser ?? null;
  }

  async function getUserByEmail(email: string): Promise<UserIdentity | null> {
    const [foundUser] = await dependencies.database
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return foundUser ?? null;
  }

  async function getOrCreateUser(input: {
    name: string;
    email: string;
  }): Promise<{ user: UserIdentity; created: boolean }> {
    const existingUser = await getUserByEmail(input.email);

    if (existingUser) {
      return { user: existingUser, created: false };
    }

    const now = new Date();
    const insertedUsers = await dependencies.database
      .insert(user)
      .values({
        ...input,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: user.email })
      .returning({ id: user.id });

    const savedUser = await getUserByEmail(input.email);

    if (!savedUser) {
      throw new Error(
        `Could not create or retrieve user with email ${input.email}.`,
      );
    }

    return { user: savedUser, created: insertedUsers.length > 0 };
  }

  return { getUserById, getOrCreateUser };
}
