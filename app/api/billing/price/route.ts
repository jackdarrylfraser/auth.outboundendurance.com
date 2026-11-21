import { getServerSession } from "@/lib/session";
import { getCurrentCheckoutPlan } from "@/lib/stripe-checkout";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const plan = await getCurrentCheckoutPlan();
  return Response.json({ plan }, { headers: noStoreHeaders });
}
