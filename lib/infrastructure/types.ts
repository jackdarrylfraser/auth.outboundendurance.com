import type { db } from "@/lib/db";
import type { stripe } from "@/lib/billing/stripe/client";
import type { getResendClient } from "@/lib/email/resend";
import type { getLogger } from "@/lib/logger";

export type Infrastructure = {
  db: typeof db;
  stripe: typeof stripe;
  resend: ReturnType<typeof getResendClient>;
  logger: ReturnType<typeof getLogger>;
};

export type InfrastructureFactoryDependencies<
  Database = Infrastructure["db"],
  StripeClient = Infrastructure["stripe"],
  ResendClient = Infrastructure["resend"],
  AppLogger = Infrastructure["logger"],
> = {
  createDb: () => Database;
  createStripe: () => StripeClient;
  createResend: () => ResendClient;
  createLogger: () => AppLogger;
};
