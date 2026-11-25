import type Stripe from "stripe";
import {
  selectStripeBillingPortalConfiguration,
  type StripeBillingPortalConfigurationCandidate,
} from "@/lib/billing/stripe/billing-portal-policy";

type StripeCustomerService = {
  getStripeCustomerId(userId: string): Promise<string | null>;
};

type StripeBillingPortalOperations = {
  configurations: {
    list(params: {
      limit: number;
    }): AsyncIterable<StripeBillingPortalConfigurationCandidate>;
  };
  sessions: {
    create(params: {
      customer: string;
      configuration: string;
      return_url: string;
    }): Promise<Pick<Stripe.BillingPortal.Session, "url">>;
  };
};

export function createStripeBillingPortalService(dependencies: {
  customerService: StripeCustomerService;
  billingPortal: StripeBillingPortalOperations;
}) {
  async function findConfiguration() {
    const configurations: StripeBillingPortalConfigurationCandidate[] = [];

    for await (const configuration of dependencies.billingPortal.configurations.list(
      { limit: 100 },
    )) {
      configurations.push(configuration);
    }

    return selectStripeBillingPortalConfiguration(configurations);
  }

  async function createPortalSession(input: {
    userId: string;
    baseUrl: string;
  }): Promise<Pick<Stripe.BillingPortal.Session, "url"> | null> {
    const customerId = await dependencies.customerService.getStripeCustomerId(
      input.userId,
    );
    if (!customerId) {
      return null;
    }

    const configuration = await findConfiguration();
    if (!configuration) {
      throw new Error(
        "No active Stripe Billing Portal configuration has the required features. Run `bun run stripe:portal:configure` with this environment's Stripe secret key.",
      );
    }

    return dependencies.billingPortal.sessions.create({
      customer: customerId,
      configuration: configuration.id,
      return_url: new URL("/manage", input.baseUrl).toString(),
    });
  }

  return { createPortalSession };
}
