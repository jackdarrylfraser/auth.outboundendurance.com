import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    TURSO_DATABASE_URL: z.string().trim().min(1),
    TURSO_AUTH_TOKEN: z.string().trim().optional(),
  },
  runtimeEnv: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  },
  emptyStringAsUndefined: true,
});
