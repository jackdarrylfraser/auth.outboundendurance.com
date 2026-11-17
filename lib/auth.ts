import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "./env";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
});
