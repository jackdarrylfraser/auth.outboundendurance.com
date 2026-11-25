import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendVerificationCode } from "@/emails/email";
import { getTrustedOrigins } from "@/lib/auth/trusted-origins";

const baseURL = new URL(env.BASE_URL);
const isProductionAuthHost =
  baseURL.hostname === "auth.outboundendurance.com";
const trustedOrigins = getTrustedOrigins(baseURL);

export const auth = betterAuth({
  baseURL: env.BASE_URL,
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
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp }) {
        await sendVerificationCode(email, otp);
      },
    }),
  ],
});
