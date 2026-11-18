import { getServerSession } from "@/lib/session";
import { listAllowedCheckoutPlans } from "@/lib/stripe-checkout";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const plans = await listAllowedCheckoutPlans();
  return Response.json({ plans }, { headers: noStoreHeaders });
}
