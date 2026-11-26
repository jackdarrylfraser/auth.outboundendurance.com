import { getServerSession } from "@/lib/auth/session";
import { getStripeLivemode } from "@/lib/billing/stripe/catalog-definition";
import { getCurrentSubscriptionPlan } from "@/lib/billing/stripe/subscription-catalog";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const publishableKey = infrastructure.env.STRIPE_PUBLISHABLE_KEY;
  const isLiveMode = getStripeLivemode(infrastructure.env.STRIPE_SECRET_KEY);
  if (
    !publishableKey ||
    !publishableKey.startsWith(isLiveMode ? "pk_live_" : "pk_test_")
  ) {
    return Response.json(
      { error: "Stripe payment configuration is unavailable." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const plan = await getCurrentSubscriptionPlan();
  return Response.json(
    { plan, publishableKey },
    { headers: noStoreHeaders },
  );
}
