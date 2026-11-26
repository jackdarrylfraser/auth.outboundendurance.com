import { and, eq } from "drizzle-orm";
import type { Infrastructure } from "@/lib/infrastructure/types";
import { role, userRole } from "@/lib/db/schema";
import { parseDatabaseUserId, toDatabaseUserId } from "@/lib/user/id";

export function createRoleService(dependencies: {
  database: Infrastructure["db"];
}) {
  async function hasRole(userId: string, roleName: string): Promise<boolean> {
    const databaseUserId = parseDatabaseUserId(userId);
    if (databaseUserId === null) {
      return false;
    }

    const [assignment] = await dependencies.database
      .select({ id: userRole.id })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(
        and(eq(userRole.userId, databaseUserId), eq(role.name, roleName)),
      )
      .limit(1);

    return assignment !== undefined;
  }

  async function assignRole(userId: string, roleName: string): Promise<void> {
    const databaseUserId = toDatabaseUserId(userId);

    await dependencies.database
      .insert(role)
      .values({ name: roleName })
      .onConflictDoNothing({ target: role.name });

    const [savedRole] = await dependencies.database
      .select({ id: role.id })
      .from(role)
      .where(eq(role.name, roleName))
      .limit(1);

    if (!savedRole) {
      throw new Error(`Could not create or retrieve role "${roleName}".`);
    }

    await dependencies.database
      .insert(userRole)
      .values({
        userId: databaseUserId,
        roleId: savedRole.id,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  return { assignRole, hasRole };
}
