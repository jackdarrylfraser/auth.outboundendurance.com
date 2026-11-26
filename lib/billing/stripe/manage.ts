import "server-only";
import { createStripeManageService } from "@/lib/billing/stripe/manage-service";
import { stripeCustomerService } from "@/lib/billing/stripe/customer";
import { infrastructure } from "@/lib/infrastructure/server";
import { stripeSubscriptionService } from "@/lib/billing/stripe/subscriptions";

export const stripeManageService = createStripeManageService({
  customerService: stripeCustomerService,
  subscriptions: stripeSubscriptionService,
  stripe: infrastructure.stripe,
});
