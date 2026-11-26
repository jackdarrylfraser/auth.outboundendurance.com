export function getStripeLivemode(secretKey: string): boolean {
  if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) {
    return true;
  }
  if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) {
    return false;
  }

  throw new Error(
    "STRIPE_SECRET_KEY must be a Stripe test or live secret key.",
  );
}
