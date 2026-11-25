import "server-only";
import { createStripeCustomerService } from "@/lib/billing/stripe/customer-service";
import { infrastructure } from "@/lib/infrastructure/server";

export const stripeCustomerService = createStripeCustomerService({
  database: infrastructure.db,
  stripeCustomers: {
    create: (customer, options) =>
      infrastructure.stripe.customers.create(customer, options),
  },
});
