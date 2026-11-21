import { unstable_rethrow } from "next/navigation";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";

const noStoreHeaders = { "Cache-Control": "no-store" };

type AccessSession = {
  user: {
    id: string;
  };
};

type AccessHandlerDependencies = {
  getSession: () => Promise<AccessSession | null>;
  requirePaidAccess: (userId: string) => Promise<void>;
  logError?: (message: string, error: unknown) => void;
};

export function createAccessHandler({
  getSession,
  requirePaidAccess,
  logError = console.error,
}: AccessHandlerDependencies) {
  return async function GET(): Promise<Response> {
    try {
      const session = await getSession();

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
