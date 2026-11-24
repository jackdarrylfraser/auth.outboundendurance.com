import { NextResponse, type NextRequest } from "next/server";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL ?? "https://auth.outboundendurance.com";

function redirectToAuth(
  request: NextRequest,
  path: "/login" | "/subscribe",
) {
  const destination = new URL(path, AUTH_SERVICE_URL);
  destination.searchParams.set("returnTo", request.url);
  return NextResponse.redirect(destination);
}

export async function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");

  if (!sessionCookie) {
    return redirectToAuth(request, "/login");
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/access", AUTH_SERVICE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access: "paid",
        cookie: {
          name: sessionCookie.name,
          value: sessionCookie.value,
        },
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not verify access with the auth service.", error);
    return new NextResponse("Unable to verify access.", { status: 503 });
  }

  if (response.status === 401) {
    return redirectToAuth(request, "/login");
  }

  if (response.status === 403) {
    return redirectToAuth(request, "/subscribe");
  }

  if (!response.ok) {
    return new NextResponse("Unable to verify access.", { status: 503 });
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Auth service returned an invalid access response.", error);
    return new NextResponse("Unable to verify access.", { status: 503 });
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "accessType" in result &&
    result.accessType === "paid" &&
    "hasAccess" in result &&
    result.hasAccess === true
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Unable to verify access.", { status: 503 });
}

export const config = {
  matcher: ["/protected/:path*"],
};
