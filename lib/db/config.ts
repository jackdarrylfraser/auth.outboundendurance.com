import { env } from "@/lib/env";

const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken } = env;

if (!url.startsWith("file:") && !authToken) {
  throw new Error("TURSO_AUTH_TOKEN must be set for a remote database.");
}

export const databaseConfig = {
  url,
  ...(authToken ? { authToken } : {}),
};
