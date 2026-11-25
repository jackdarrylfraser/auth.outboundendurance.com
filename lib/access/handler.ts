import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import type { AccessHandlerDependencies } from "@/lib/access/types";
import { getLogger } from "@/lib/logger";

const noStoreHeaders = { "Cache-Control": "no-store" };
const accessRequestSchema = z.object({
  cookie: z.object({
    name: z.enum([
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
    ]),
    value: z.string().min(1).max(4096),
  }),
  access: z.enum(["authenticated", "paid"]).default("paid"),
});

export function createAccessHandler({
  getSession,
  requirePaidAccess,
  logError = (message, error) => getLogger().error({ err: error }, message),
}: AccessHandlerDependencies) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const parsedBody = accessRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json(
        { error: "A session cookie is required." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    try {
      const session = await getSession(parsedBody.data.cookie);

      if (!session) {
        return Response.json(
          { accessType: parsedBody.data.access, hasAccess: false },
          { status: 401, headers: noStoreHeaders },
        );
      }

      if (parsedBody.data.access === "authenticated") {
        return Response.json(
          { accessType: "authenticated", hasAccess: true },
          { headers: noStoreHeaders },
        );
      }

      await requirePaidAccess(session.user.id);
      return Response.json(
        { accessType: "paid", hasAccess: true },
        { headers: noStoreHeaders },
      );
    } catch (error) {
      unstable_rethrow(error);

      if (error instanceof PaidAccessRequiredError) {
        return Response.json(
          { accessType: "paid", hasAccess: false },
          { status: 403, headers: noStoreHeaders },
        );
      }

      logError("Access check failed.", error);
      return Response.json(
        { error: "Unable to verify access." },
        { status: 503, headers: noStoreHeaders },
      );
    }
  };
}
