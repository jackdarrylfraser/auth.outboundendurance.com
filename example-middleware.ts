import { NextResponse, type NextRequest } from "next/server";

const authServiceUrl =
  process.env.AUTH_SERVICE_URL ?? "https://auth.outboundendurance.com";

type AccessLevel = "authenticated" | "paid";

const routeAccessRules: { prefix: string; access: AccessLevel }[] = [
  { prefix: "/protected/account", access: "authenticated" },
  { prefix: "/protected/courses", access: "paid" },
];

function getRequiredAccess(pathname: string): AccessLevel {
  const matchingRules = routeAccessRules
    .filter(
      ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
    .sort((left, right) => right.prefix.length - left.prefix.length);

  return matchingRules[0]?.access ?? "paid";
}

function redirectToAuth(
  request: NextRequest,
  path: "/login" | "/subscribe",
) {
  const destination = new URL(path, authServiceUrl);
  destination.searchParams.set("returnTo", request.url);
  return Response.redirect(destination);
}

function denyAccess(request: NextRequest, access: AccessLevel) {
  if (access === "paid") {
    return redirectToAuth(request, "/subscribe");
  }

  return new Response("Access denied.", { status: 403 });
}

function getSessionCookie(request: Request) {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const sessionCookieNames = [
    "__Secure-better-auth.session_token",
    "better-auth.session_token",
  ];

  for (const name of sessionCookieNames) {
    const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
    const value = cookie?.slice(cookie.indexOf("=") + 1).trim();
    if (value) {
      return { name, value };
    }
  }

  return undefined;
}

export default async function proxy(request: NextRequest) {
  const requiredAccess = getRequiredAccess(new URL(request.url).pathname);
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return redirectToAuth(request, "/login");
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/access", authServiceUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access: requiredAccess,
        cookie: {
          name: sessionCookie.name,
          value: sessionCookie.value,
        },
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not verify access with the auth service.", error);
    return new Response("Unable to verify access.", { status: 503 });
  }

  if (response.status === 401) {
    return redirectToAuth(request, "/login");
  }

  if (response.status === 403) {
    return denyAccess(request, requiredAccess);
  }

  if (!response.ok) {
    console.error(
      "Auth service could not verify access.",
      `Unexpected status: ${response.status}`,
    );
    return new Response("Unable to verify access.", { status: 503 });
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Auth service returned an invalid access response.", error);
    return new Response("Unable to verify access.", { status: 503 });
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "accessType" in result &&
    typeof result.accessType === "string" &&
    "hasAccess" in result &&
    typeof result.hasAccess === "boolean"
  ) {
    if (
      !result.hasAccess ||
      (requiredAccess === "paid" && result.accessType !== "paid")
    ) {
      return denyAccess(request, requiredAccess);
    }

    return NextResponse.next();
  }

  return new Response("Unable to verify access.", { status: 503 });
}

export const config = {
  matcher: ["/protected/:path*"],
};
