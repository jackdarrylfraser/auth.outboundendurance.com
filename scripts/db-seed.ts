import { infrastructure } from "@/lib/infrastructure/runtime";
import { createUserService } from "@/lib/user/service";

const seedUser = {
  id: "seed-user-local",
  name: "Local Seed User",
  email: "seed.user@example.test",
};
const userService = createUserService({ database: infrastructure.db });

async function seed(): Promise<void> {
  if (!infrastructure.env.TURSO_DATABASE_URL.startsWith("file:")) {
    throw new Error(
      "Database seeding is restricted to local file databases. Set TURSO_DATABASE_URL to a file: URL.",
    );
  }

  const { user: savedUser, created } =
    await userService.getOrCreateUser(seedUser);

  infrastructure.logger.info(
    { userId: savedUser.id, email: seedUser.email },
    created ? "Development user seeded" : "Development user already exists",
  );
}

try {
  await seed();
} finally {
  await infrastructure.db.$client.close();
}
