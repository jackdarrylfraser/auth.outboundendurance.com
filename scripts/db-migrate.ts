import { migrate } from "drizzle-orm/libsql/migrator";
import { client, db } from "@/lib/db";

function logMigrationError(error: unknown, label = "Drizzle migration failed"): void {
  if (error instanceof Error) {
    console.error(`${label}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }

    for (const property of ["code", "rawCode", "extendedCode"]) {
      const value = Reflect.get(error, property);
      if (value !== undefined) {
        console.error(`${property}: ${String(value)}`);
      }
    }

    if (error.cause !== undefined) {
      logMigrationError(error.cause, "Migration cause");
    }
    return;
  }

  console.error(`${label}:`, error);
}

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("Database migrations applied successfully.");
} catch (error) {
  logMigrationError(error);
  process.exitCode = 1;
} finally {
  await client.close();
}
