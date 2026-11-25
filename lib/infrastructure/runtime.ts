import { Vercel } from "@vercel/sdk";
import { stripe } from "@/lib/billing/stripe/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getResendClient } from "@/lib/email/resend";
import { getLogger } from "@/lib/logger";
import { createInfrastructure } from "@/lib/infrastructure/factory";
import type { Infrastructure } from "@/lib/infrastructure/types";

export const infrastructure: Infrastructure = createInfrastructure({
  env,
  createDb: () => db,
  createStripe: () => stripe,
  createResend: getResendClient,
  createLogger: getLogger,
  createVercel: () =>
    new Vercel({ bearerToken: env.VERCEL_TOKEN, timeoutMs: 30_000 }),
});
