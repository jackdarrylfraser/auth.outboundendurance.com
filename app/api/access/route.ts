import { createAccessHandler } from "@/lib/access-handler";
import { requirePaidAccess } from "@/lib/entitlement";
import { getServerSession } from "@/lib/session";

export const GET = createAccessHandler({
  getSession: getServerSession,
  requirePaidAccess,
});
