import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().trim().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().trim().min(1),
    RESEND_API_KEY: z.string().trim().min(1),
    RESEND_FROM_EMAIL: z.string().trim().min(1),
    TURSO_DATABASE_URL: z.string().trim().min(1),
    TURSO_AUTH_TOKEN: z.string().trim().optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().trim().min(1),
    NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID: z.string().trim().min(1),
  },
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID:
      process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID,
  },
  emptyStringAsUndefined: true,
});
