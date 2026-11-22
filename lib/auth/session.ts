import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
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
