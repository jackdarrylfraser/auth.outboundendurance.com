import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
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
});

type AccessSession = {
  user: {
    id: string;
  };
};

type AccessHandlerDependencies = {
  getSession: (cookie: { name: string; value: string }) => Promise<AccessSession | null>;
  requirePaidAccess: (userId: string) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
};

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
          { error: "Unauthorized" },
          { status: 401, headers: noStoreHeaders },
        );
      }

      await requirePaidAccess(session.user.id);
      return Response.json({ entitled: true }, { headers: noStoreHeaders });
    } catch (error) {
      unstable_rethrow(error);

      if (error instanceof PaidAccessRequiredError) {
        return Response.json(
          { entitled: false },
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
