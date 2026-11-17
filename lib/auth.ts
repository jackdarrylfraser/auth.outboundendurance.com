import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { env } from "./env";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendVerificationCode } from "./email";

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
