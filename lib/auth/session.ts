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
  const { headers: responseHeaders, response: session } =
    await auth.api.getSession({
      headers: requestHeaders,
      returnHeaders: true,
    });
  const secureCookieName = "__Secure-better-auth.session_token";
  const plainCookieName = "better-auth.session_token";
  const expectedSessionCookieName =
    new URL(env.BASE_URL).protocol === "https:"
      ? secureCookieName
      : plainCookieName;
  const setCookieHeader = responseHeaders.get("set-cookie") ?? "";
  const sessionCookieExpired =
    setCookieHeader.includes(`${expectedSessionCookieName}=`) &&
    /max-age\s*=\s*0/i.test(setCookieHeader);
  const sessionLookupResult = session
    ? "accepted"
    : sessionCookieExpired
      ? "valid_cookie_without_active_session"
      : "cookie_not_accepted";

  getLogger().debug(
    {
      sessionFound: Boolean(session),
      sessionLookupResult,
      sessionCookieExpired,
      requestHost: requestHeaders.get("host"),
      forwardedHost: requestHeaders.get("x-forwarded-host"),
      authOrigin: new URL(env.BASE_URL).origin,
      databaseHost: new URL(env.TURSO_DATABASE_URL).host,
      expectedSessionCookieName,
      secureSessionCookieCount: countCookie(requestHeaders, secureCookieName),
      plainSessionCookieCount: countCookie(requestHeaders, plainCookieName),
    },
    "Better Auth session lookup completed",
  );

  return session;
}

export async function getSessionFromCookie(cookie: {
  name: string;
  value: string;
}) {
  return auth.api.getSession({
    headers: new Headers({ cookie: `${cookie.name}=${cookie.value}` }),
  });
}
