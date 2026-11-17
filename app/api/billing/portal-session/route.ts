import { getServerSession } from "@/lib/session";
import { env } from "@/lib/env";
import { getStripeCustomerId, stripe } from "@/lib/stripe";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const customerId = await getStripeCustomerId(session.user.id);

  if (!customerId) {
    return Response.json(
      { error: "No Stripe customer is associated with this account." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: new URL("/account", env.BETTER_AUTH_URL).toString(),
  });

  return Response.json(
    { url: portalSession.url },
    { headers: noStoreHeaders },
  );
}
