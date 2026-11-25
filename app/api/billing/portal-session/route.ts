import { getServerSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { createStripeBillingPortalService } from "@/lib/billing/stripe/billing-portal-service";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

const billingPortalService = createStripeBillingPortalService({
  customerService: stripeCustomerService,
  billingPortal: infrastructure.stripe.billingPortal,
});

export async function POST() {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const portalSession = await billingPortalService.createPortalSession({
    userId: session.user.id,
    baseUrl: env.BASE_URL,
  });
  if (!portalSession) {
    return Response.json(
      { error: "No Stripe customer is associated with this account." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  return Response.json(
    { url: portalSession.url },
    { headers: noStoreHeaders },
  );
}
