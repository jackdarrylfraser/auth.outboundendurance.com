import "server-only";
import { stripe } from "@/lib/billing/stripe/client";
import { db } from "@/lib/db";
import { getResendClient } from "@/lib/email/resend";
import { getLogger } from "@/lib/logger";
import { createInfrastructure } from "@/lib/infrastructure/factory";
import type { Infrastructure } from "@/lib/infrastructure/types";

export const infrastructure: Infrastructure = createInfrastructure({
  createDb: () => db,
  createStripe: () => stripe,
  createResend: getResendClient,
  createLogger: getLogger,
});
