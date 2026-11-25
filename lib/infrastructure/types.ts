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
