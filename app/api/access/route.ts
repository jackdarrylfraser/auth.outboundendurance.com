import { createAccessHandler } from "@/lib/access/handler";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { getSessionFromToken } from "@/lib/auth/session";

export const POST = createAccessHandler({
  getSession: getSessionFromToken,
  requirePaidAccess,
});
