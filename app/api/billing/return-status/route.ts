import { getServerSession } from "@/lib/auth/session";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { env } from "@/lib/env";
import { getStripeCustomerId, stripe } from "@/lib/billing/stripe/client";
import { getStripeCustomerIdFromSession } from "@/lib/billing/stripe/checkout";
import { isCheckoutSessionId } from "@/lib/billing/stripe/checkout-policy";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    throw error;
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("sessionId" in body) ||
    typeof body.sessionId !== "string" ||
    !isCheckoutSessionId(body.sessionId)
  ) {
    return Response.json(
      { error: "A valid Checkout Session ID is required." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(
    body.sessionId,
  );
  const customerId = await getStripeCustomerId(session.user.id);
  if (
    checkoutSession.metadata?.userId !== session.user.id ||
    !customerId ||
    getStripeCustomerIdFromSession(checkoutSession.customer) !== customerId
  ) {
    return Response.json(
      { error: "Checkout Session not found." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (checkoutSession.mode !== "subscription" || checkoutSession.status !== "complete") {
    return Response.json(
      { error: "Checkout Session is not complete." },
      { status: 409, headers: noStoreHeaders },
    );
  }

  try {
    await requirePaidAccess(session.user.id);
    return Response.json(
      {
        status: "confirmed",
        returnTo: getAllowedReturnUrl(
          checkoutSession.metadata?.returnTo,
          env.BASE_URL,
        ),
      },
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
