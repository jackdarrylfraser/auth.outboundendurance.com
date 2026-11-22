import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getSessionFromToken(token: string) {
  const requestHeaders = new Headers({
    cookie: `better-auth.session_token=${encodeURIComponent(token)}`,
  });

  return auth.api.getSession({ headers: requestHeaders });
}
