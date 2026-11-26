import { infrastructure } from "@/lib/infrastructure/runtime";
import { createRoleService } from "@/lib/role/service";
import { createUserService } from "@/lib/user/service";

const seedUser = {
  name: "Local Seed User",
  email: "seed.user@example.test",
  roles: ["admin"],
};
const userService = createUserService({ database: infrastructure.db });
const roleService = createRoleService({ database: infrastructure.db });

async function seed(): Promise<void> {
  const { user: savedUser, created } =
    await userService.getOrCreateUser({
      name: seedUser.name,
      email: seedUser.email,
    });

  for (const role of seedUser.roles) {
    await roleService.assignRole(String(savedUser.id), role);
  }

  infrastructure.logger.info(
    { userId: savedUser.id, email: seedUser.email, roles: seedUser.roles },
    created ? "Development user seeded" : "Development user already exists",
  );
}

try {
  await seed();
} finally {
  await infrastructure.db.$client.close();
}
