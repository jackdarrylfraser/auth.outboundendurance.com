import { getServerSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getStripeCustomerId, stripe } from "@/lib/billing/stripe/client";
import { findStripeBillingPortalConfiguration } from "@/lib/billing/stripe/billing-portal";

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

  const configuration = await findStripeBillingPortalConfiguration(stripe);
  if (!configuration) {
    throw new Error(
      "No active Stripe Billing Portal configuration has the required features. Run `bun run stripe:portal:configure` with this environment's Stripe secret key.",
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: configuration.id,
    return_url: new URL("/manage", env.BETTER_AUTH_URL).toString(),
  });

  return Response.json(
    { url: portalSession.url },
    { headers: noStoreHeaders },
  );
}
