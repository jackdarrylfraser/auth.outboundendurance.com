import { getServerSession } from "@/lib/session";
import { env } from "@/lib/env";
import {
  requirePaidAccess,
} from "@/lib/entitlement";
import { PaidAccessRequiredError } from "@/lib/entitlement-policy";
import { getOrCreateStripeCustomer, stripe } from "@/lib/stripe";
import { getCurrentCheckoutPlan } from "@/lib/stripe-checkout";
import {
  getCheckoutCancelUrl,
  getCheckoutSuccessUrl,
  STRIPE_METADATA_VALUE_MAX_LENGTH,
} from "@/lib/stripe-checkout-policy";
import { getAllowedReturnUrl } from "@/lib/return-url";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    await requirePaidAccess(session.user.id);
    return Response.json(
      { error: "This account already has paid access." },
      { status: 409, headers: noStoreHeaders },
    );
  } catch (error) {
    if (!(error instanceof PaidAccessRequiredError)) {
      throw error;
    }
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
    env.BETTER_AUTH_URL,
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

  const plan = await getCurrentCheckoutPlan();

  const customerId = await getOrCreateStripeCustomer({
    id: session.user.id,
    email: session.user.email,
  });
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: getCheckoutSuccessUrl(env.BETTER_AUTH_URL),
    cancel_url: getCheckoutCancelUrl(env.BETTER_AUTH_URL, returnTo),
    metadata: {
      userId: session.user.id,
      ...(returnTo ? { returnTo } : {}),
    },
    subscription_data: {
      metadata: { userId: session.user.id },
    },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }

  return Response.json(
    { url: checkoutSession.url },
    { headers: noStoreHeaders },
  );
}
