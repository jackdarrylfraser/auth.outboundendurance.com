import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "./env";
import { db } from "./db";
import * as schema from "./db/schema";

const baseURL = new URL(env.BETTER_AUTH_URL);
const isProductionAuthHost =
  baseURL.hostname === "auth.outboundendurance.com";

const trustedOrigins = [baseURL.origin];

if (isProductionAuthHost) {
  trustedOrigins.push(
    "https://*.outboundendurance.com",
    "https://outboundendurance.com",
  );
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  advanced: {
    crossSubDomainCookies: {
      enabled: isProductionAuthHost,
      ...(isProductionAuthHost ? { domain: ".outboundendurance.com" } : {}),
    },
  },
});
