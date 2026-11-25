import "server-only";
import { stripe } from "@/lib/billing/stripe/client";
import { createStripeCustomerService } from "@/lib/billing/stripe/customer-service";
import { db } from "@/lib/db";

export const stripeCustomerService = createStripeCustomerService({
  database: db,
  stripeCustomers: {
    create: (customer, options) =>
      stripe.customers.create(customer, options),
  },
});
