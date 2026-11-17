import { defineConfig } from "drizzle-kit";
import { databaseConfig } from "./lib/db/config";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: databaseConfig,
});
