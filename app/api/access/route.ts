import { createAccessHandler } from "@/lib/access/handler";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { getSessionFromCookie } from "@/lib/auth/session";

export const POST = createAccessHandler({
  getSession: getSessionFromCookie,
  requirePaidAccess,
});
