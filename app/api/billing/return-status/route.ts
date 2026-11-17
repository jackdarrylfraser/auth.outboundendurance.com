import { getServerSession } from "@/lib/session";
import { PaidAccessRequiredError } from "@/lib/entitlement-policy";
import { requirePaidAccess } from "@/lib/entitlement";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    await requirePaidAccess(session.user.id);
    return Response.json(
      { status: "confirmed" },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (!(error instanceof PaidAccessRequiredError)) {
      throw error;
    }

    return Response.json(
      { status: "processing" },
      { headers: noStoreHeaders },
    );
  }
}
