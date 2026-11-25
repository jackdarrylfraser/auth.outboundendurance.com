import { getServerSession } from "@/lib/auth/session";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { requirePaidAccess } from "@/lib/access/entitlement";
import { env } from "@/lib/env";
import { stripe } from "@/lib/billing/stripe/client";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { getStripeCustomerIdFromSession } from "@/lib/billing/stripe/checkout";
import { isCheckoutSessionId } from "@/lib/billing/stripe/checkout-policy";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";

const noStoreHeaders = { "Cache-Control": "no-store" };

class InvalidRequestBodyError extends Error {}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const body: unknown = await request.json().catch((error: unknown) => {
      if (error instanceof SyntaxError) {
        throw new InvalidRequestBodyError();
      }
      throw error;
    });

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
    const customerId = await stripeCustomerService.getStripeCustomerId(
      session.user.id,
    );
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

    if (
      checkoutSession.mode !== "subscription" ||
      checkoutSession.status !== "complete"
    ) {
      return Response.json(
        { error: "Checkout Session is not complete." },
        { status: 409, headers: noStoreHeaders },
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
        returnTo: getAllowedReturnUrl(
          checkoutSession.metadata?.returnTo,
          env.BASE_URL,
        ),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof InvalidRequestBodyError) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    throw error;
  }
}
