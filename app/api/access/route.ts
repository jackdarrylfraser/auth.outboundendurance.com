import { createAccessHandler } from "@/lib/access/handler";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { getServerSession } from "@/lib/auth/session";

export const GET = createAccessHandler({
  getSession: getServerSession,
  requirePaidAccess,
});
