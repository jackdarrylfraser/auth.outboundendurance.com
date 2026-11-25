import { getServerSession } from "@/lib/auth/session";
import {
  requirePaidAccess,
} from "@/lib/access/entitlement";
import { PaidAccessRequiredError } from "@/lib/access/entitlement-policy";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { getCurrentCheckoutPlan } from "@/lib/billing/stripe/checkout-catalog";
import { createStripeCheckoutService } from "@/lib/billing/stripe/checkout";
import {
  STRIPE_METADATA_VALUE_MAX_LENGTH,
} from "@/lib/billing/stripe/checkout-policy";
import { getAllowedReturnUrl } from "@/lib/auth/return-url";
import { infrastructure } from "@/lib/infrastructure/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

const checkoutService = createStripeCheckoutService({
  getCurrentPlan: getCurrentCheckoutPlan,
  customerService: stripeCustomerService,
  checkoutSessions: infrastructure.stripe.checkout.sessions,
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: noStoreHeaders },
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
    if (hasPaidAccess) {
      return Response.json(
        { error: "This account already has paid access." },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const requestedReturnTo =
      "returnTo" in body ? body.returnTo : undefined;
    if (
      requestedReturnTo !== undefined &&
      requestedReturnTo !== null &&
      typeof requestedReturnTo !== "string"
    ) {
      return Response.json(
        { error: "The return URL is invalid." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const returnTo = getAllowedReturnUrl(
      typeof requestedReturnTo === "string" ? requestedReturnTo : undefined,
      infrastructure.env.BASE_URL,
    );
    if (requestedReturnTo && !returnTo) {
      return Response.json(
        { error: "The return URL is not allowed." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (returnTo && returnTo.length > STRIPE_METADATA_VALUE_MAX_LENGTH) {
      return Response.json(
        { error: "The return URL is too long to store in Stripe Checkout metadata." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const checkoutUrl = await checkoutService.createCheckoutSession({
      user: {
        id: session.user.id,
        email: session.user.email,
      },
      baseUrl: infrastructure.env.BASE_URL,
      returnTo,
    });

    return Response.json(
      { url: checkoutUrl },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    throw error;
  }
}
