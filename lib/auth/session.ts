import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { getLogger } from "@/lib/logger";

function countCookie(headers: Headers, cookieName: string): number {
  return (headers.get("cookie") ?? "")
    .split(";")
    .filter((cookie) => cookie.split("=", 1)[0].trim() === cookieName).length;
}

export async function getServerSession() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const secureCookieName = "__Secure-better-auth.session_token";
  const plainCookieName = "better-auth.session_token";

  getLogger().debug(
    {
      sessionFound: Boolean(session),
      requestHost: requestHeaders.get("host"),
      forwardedHost: requestHeaders.get("x-forwarded-host"),
      authOrigin: new URL(env.BETTER_AUTH_URL).origin,
      expectedSessionCookieName:
        new URL(env.BETTER_AUTH_URL).protocol === "https:"
          ? secureCookieName
          : plainCookieName,
      secureSessionCookieCount: countCookie(requestHeaders, secureCookieName),
      plainSessionCookieCount: countCookie(requestHeaders, plainCookieName),
    },
    "Better Auth session lookup completed",
  );

  return session;
}

export async function getSessionFromToken(token: string) {
  const { internalAdapter } = await auth.$context;
  const result = await internalAdapter.findSession(token);

  if (!result) {
    return null;
  }

  if (result.session.expiresAt <= new Date()) {
    await internalAdapter.deleteSession(result.session.token);
    return null;
  }

  return result;
}
