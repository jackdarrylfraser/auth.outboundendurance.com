export const STRIPE_METADATA_VALUE_MAX_LENGTH = 500;

export function parseStripePriceId(value: string): string {
  const priceId = value.trim();

  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) {
    throw new Error("STRIPE_PRICE_ID must contain a valid Price ID.");
  }

  return priceId;
}

export function isCheckoutSessionId(value: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(value);
}

export function getCheckoutSuccessUrl(authUrl: string): string {
  const returnUrl = new URL("/billing/return", authUrl);
  return `${returnUrl.origin}${returnUrl.pathname}?session_id={CHECKOUT_SESSION_ID}`;
}

export function getCheckoutCancelUrl(
  authUrl: string,
  returnTo: string | null,
): string {
  const cancelUrl = new URL("/account", authUrl);
  if (returnTo) {
    cancelUrl.searchParams.set("returnTo", returnTo);
  }
  return cancelUrl.href;
}
