import { getServerSession } from "@/lib/auth/session";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const body: unknown = await request.json();

    if (
      !isRecord(body) ||
      ("returnTo" in body &&
        body.returnTo !== null &&
        typeof body.returnTo !== "string")
    ) {
      return Response.json(
        { error: "Invalid billing return request." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const requestedReturnTo =
      typeof body.returnTo === "string" ? body.returnTo : undefined;
    const returnTo = getAllowedReturnUrl(
      requestedReturnTo,
      infrastructure.env.BASE_URL,
    );
    if (requestedReturnTo && !returnTo) {
      return Response.json(
        { error: "The return URL is not allowed." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const hasPaidAccess = await requirePaidAccess(session.user.id).then(
      () => true,
      (error: unknown) => {
        if (error instanceof PaidAccessRequiredError) {
          return false;
        }
        throw error;
      },
    );
    if (!hasPaidAccess) {
      return Response.json(
        { status: "processing" },
        { headers: noStoreHeaders },
      );
    }

    return Response.json(
      {
        status: "confirmed",
        returnTo,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    throw error;
  }
}
