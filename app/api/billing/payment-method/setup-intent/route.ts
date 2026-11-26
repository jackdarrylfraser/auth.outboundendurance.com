import { getServerSession } from "@/lib/auth/session";
import { getStripeLivemode } from "@/lib/billing/stripe/mode";
import { stripeManageService } from "@/lib/billing/stripe/manage";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
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

  const setup = await stripeManageService.createPaymentMethodSetup(
    session.user.id,
  );
  if (!setup) {
    return Response.json(
      { error: "No Stripe customer is associated with this account." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return Response.json(
    { ...setup, publishableKey },
    { headers: noStoreHeaders },
  );
}
