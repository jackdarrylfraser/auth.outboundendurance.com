import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendVerificationCode } from "@/emails/email";

const baseURL = new URL(env.BETTER_AUTH_URL);
const isProductionAuthHost =
  baseURL.hostname === "auth.outboundendurance.com";

const trustedOrigins = [baseURL.origin];

if (isProductionAuthHost) {
  trustedOrigins.push(
    "https://*.outboundendurance.com",
    "https://outboundendurance.com",
  );
} else if (baseURL.protocol === "http:" && baseURL.hostname === "localhost") {
  trustedOrigins.push("http://localhost:*");
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
