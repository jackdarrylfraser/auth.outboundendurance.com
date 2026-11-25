import type Stripe from "stripe";
import {
  getCheckoutCancelUrl,
  getCheckoutSuccessUrl,
  STRIPE_METADATA_VALUE_MAX_LENGTH,
} from "@/lib/billing/stripe/checkout-policy";

export type CheckoutPlan = {
  priceId: string;
  name: string;
  description: string | null;
  unitAmount: number;
  currency: string;
  interval: string;
  intervalCount: number;
};

export function getStripeCustomerIdFromSession(
  customer: Stripe.Checkout.Session["customer"],
): string | null {
  if (typeof customer === "string") {
    return customer;
  }

  return customer?.id ?? null;
}

type CheckoutUser = {
  id: string;
  email: string;
};

type StripeCustomerService = {
  getOrCreateStripeCustomer(user: CheckoutUser): Promise<string>;
};

type StripeCheckoutOperations = {
  create(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<{ url: string | null }>;
};

export function createStripeCheckoutService(dependencies: {
  getCurrentPlan: () => Promise<CheckoutPlan>;
  customerService: StripeCustomerService;
  checkoutSessions: StripeCheckoutOperations;
}) {
  async function createCheckoutSession(input: {
    user: CheckoutUser;
    baseUrl: string;
    returnTo: string | null;
  }): Promise<string> {
    if (
      input.returnTo &&
      input.returnTo.length > STRIPE_METADATA_VALUE_MAX_LENGTH
    ) {
      throw new Error(
        "The return URL is too long to store in Stripe Checkout metadata.",
      );
    }

    const plan = await dependencies.getCurrentPlan();
    const customerId =
      await dependencies.customerService.getOrCreateStripeCustomer(input.user);
    const checkoutSession = await dependencies.checkoutSessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: getCheckoutSuccessUrl(input.baseUrl),
      cancel_url: getCheckoutCancelUrl(input.baseUrl, input.returnTo),
      metadata: {
        userId: input.user.id,
        ...(input.returnTo ? { returnTo: input.returnTo } : {}),
      },
      subscription_data: {
        metadata: { userId: input.user.id },
      },
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a Checkout Session URL.");
    }

    return checkoutSession.url;
  }

  return { createCheckoutSession };
}
