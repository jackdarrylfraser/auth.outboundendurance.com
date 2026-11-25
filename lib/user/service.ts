import { eq } from "drizzle-orm";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { user } from "@/lib/db/schema";

type UserIdentity = Pick<typeof user.$inferSelect, "id" | "name" | "email">;

export function createUserService(dependencies: {
  database: Infrastructure["db"];
}) {
  async function getOrCreateUser(input: {
    id: string;
    name: string;
    email: string;
  }): Promise<{ user: UserIdentity; created: boolean }> {
    const [existingUser] = await dependencies.database
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);

    if (existingUser) {
      if (existingUser.id !== input.id) {
        throw new Error(
          `Cannot create user ${input.id}: email ${input.email} belongs to another user.`,
        );
      }

      return { user: existingUser, created: false };
    }

    const now = new Date();
    await dependencies.database
      .insert(user)
      .values({
        ...input,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const [savedUser] = await dependencies.database
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);

    if (!savedUser || savedUser.id !== input.id) {
      throw new Error(
        `Could not create user ${input.id}; the user ID may already be in use.`,
      );
    }

    return { user: savedUser, created: true };
  }

  return { getOrCreateUser };
}
