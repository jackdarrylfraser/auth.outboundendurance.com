import Stripe from "stripe";
import { env } from "./env";
import { stripe } from "./stripe";
import { parseStripePriceId } from "./stripe-checkout-policy";

export type CheckoutPlan = {
  priceId: string;
  name: string;
  description: string | null;
  unitAmount: number;
  currency: string;
  interval: string;
  intervalCount: number;
};

export async function getCurrentCheckoutPlan(): Promise<CheckoutPlan> {
  return getCheckoutPlan(parseStripePriceId(env.STRIPE_PRICE_ID));
}

async function getCheckoutPlan(priceId: string): Promise<CheckoutPlan> {
  const price = await stripe.prices.retrieve(priceId, {
    expand: ["product"],
  });

  if (
    !price.active ||
    price.type !== "recurring" ||
    !price.recurring ||
    price.unit_amount === null
  ) {
    throw new Error(
      `Configured Stripe Price ${priceId} must be an active recurring price with a fixed amount.`,
    );
  }

  const product =
    typeof price.product === "string"
      ? await stripe.products.retrieve(price.product)
      : price.product;

  if ("deleted" in product && product.deleted) {
    throw new Error(`Configured Stripe Price ${priceId} has a deleted product.`);
  }
  if (!product.active) {
    throw new Error(`Configured Stripe Price ${priceId} has an inactive product.`);
  }

  return {
    priceId: price.id,
    name: product.name,
    description: product.description,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring.interval,
    intervalCount: price.recurring.interval_count,
  };
}

export function getStripeCustomerIdFromSession(
  customer: Stripe.Checkout.Session["customer"],
): string | null {
  if (typeof customer === "string") {
    return customer;
  }

  return customer?.id ?? null;
}
