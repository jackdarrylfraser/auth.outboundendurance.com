import type { Vercel } from "@vercel/sdk";
import type { db } from "@/lib/db";
import type { stripe } from "@/lib/billing/stripe/client";
import type { getResendClient } from "@/lib/email/resend";
import type { getLogger } from "@/lib/logger";
import type { env } from "@/lib/env";

export type Infrastructure = {
  env: typeof env;
  db: typeof db;
  stripe: typeof stripe;
  resend: ReturnType<typeof getResendClient>;
  logger: ReturnType<typeof getLogger>;
  vercel: Vercel;
};

export type InfrastructureFactoryDependencies<
  Database = Infrastructure["db"],
  StripeClient = Infrastructure["stripe"],
  ResendClient = Infrastructure["resend"],
  AppLogger = Infrastructure["logger"],
  VercelClient = Infrastructure["vercel"],
  Environment = Infrastructure["env"],
> = {
  env: Environment;
  createDb: () => Database;
  createStripe: () => StripeClient;
  createResend: () => ResendClient;
  createLogger: () => AppLogger;
  createVercel: () => VercelClient;
};
