import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { createAccessService } from "@/lib/access/service";
import { getSessionFromCookie } from "@/lib/auth/session";
import { getLogger } from "@/lib/logger";

const noStoreHeaders = { "Cache-Control": "no-store" };
const accessService = createAccessService({
  getSession: getSessionFromCookie,
  requirePaidAccess,
});
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

export async function POST(request: Request): Promise<Response> {
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
    const decision = await accessService.checkAccess(parsedBody.data);
    switch (decision.type) {
      case "unauthenticated":
        return Response.json(
          { accessType: decision.accessType, hasAccess: false },
          { status: 401, headers: noStoreHeaders },
        );
      case "forbidden":
        return Response.json(
          { accessType: "paid", hasAccess: false },
          { status: 403, headers: noStoreHeaders },
        );
      case "authenticated":
        return Response.json(
          { accessType: "authenticated", hasAccess: true },
          { headers: noStoreHeaders },
        );
      case "paid":
        return Response.json(
          { accessType: "paid", hasAccess: true },
          { headers: noStoreHeaders },
        );
    }
  } catch (error) {
    unstable_rethrow(error);

    getLogger().error({ err: error }, "Access check failed.");
    return Response.json(
      { error: "Unable to verify access." },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
