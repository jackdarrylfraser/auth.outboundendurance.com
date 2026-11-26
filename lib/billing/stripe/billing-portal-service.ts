import type Stripe from "stripe";
import {
  selectStripeBillingPortalConfiguration,
  type StripeBillingPortalConfigurationCandidate,
} from "@/lib/billing/stripe/billing-portal-selector";

type StripeBillingPortalConfigurationOperations<
  T extends StripeBillingPortalConfigurationCandidate,
> = {
  configurations: {
    list(params: {
      limit: number;
    }): AsyncIterable<T>;
  };
};

export async function findStripeBillingPortalConfiguration<
  T extends StripeBillingPortalConfigurationCandidate,
>(
  billingPortal: StripeBillingPortalConfigurationOperations<T>,
): Promise<T | null> {
  const configurations: T[] = [];

  for await (const configuration of billingPortal.configurations.list({
    limit: 100,
  })) {
    configurations.push(configuration);
  }

  return selectStripeBillingPortalConfiguration(configurations);
}

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
    return findStripeBillingPortalConfiguration(dependencies.billingPortal);
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
        "No active Stripe Billing Portal configuration has the required features. Provision it with `bun run stripe:portal:configure` before serving billing traffic.",
      );
    }

    return dependencies.billingPortal.sessions.create({
      customer: customerId,
      configuration: configuration.id,
      return_url: new URL("/manage", input.baseUrl).toString(),
    });
  }

  return {
    createPortalSession,
    findStripeBillingPortalConfiguration: findConfiguration,
  };
}
