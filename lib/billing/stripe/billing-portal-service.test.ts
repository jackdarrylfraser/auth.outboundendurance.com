import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getStripeBillingPortalConfigurationFeatures,
  STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER,
  type StripeBillingPortalConfigurationCandidate,
} from "@/lib/billing/stripe/billing-portal-policy";
import { createStripeBillingPortalService } from "@/lib/billing/stripe/billing-portal-service";

function configuration(
  id: string,
  managed = false,
): StripeBillingPortalConfigurationCandidate {
  return {
    id,
    active: true,
    is_default: false,
    metadata: managed
      ? { managed_by: STRIPE_BILLING_PORTAL_CONFIGURATION_MARKER }
      : null,
    features: getStripeBillingPortalConfigurationFeatures(["feedback_1"]),
  };
}

describe("Stripe Billing Portal service", () => {
  it("uses the mapped customer, selected configuration, and manage return URL", async () => {
    const calls: string[] = [];
    let sessionParams:
      | {
          customer: string;
          configuration: string;
          return_url: string;
        }
      | undefined;
    const service = createStripeBillingPortalService({
      customerService: {
        async getStripeCustomerId(userId) {
          calls.push(`customer:${userId}`);
          return "cus_123";
        },
      },
      billingPortal: {
        configurations: {
          async *list(params) {
            calls.push(`configurations:${params.limit}`);
            yield configuration("bpc_default_match");
            yield configuration("bpc_managed_match", true);
          },
        },
        sessions: {
          async create(params) {
            calls.push("session");
            sessionParams = params;
            return { url: "https://billing.stripe.com/session" };
          },
        },
      },
    });

    const session = await service.createPortalSession({
      userId: "user_123",
      baseUrl: "https://auth.example.com",
    });

    assert.deepEqual(session, { url: "https://billing.stripe.com/session" });
    assert.deepEqual(calls, ["customer:user_123", "configurations:100", "session"]);
    assert.deepEqual(sessionParams, {
      customer: "cus_123",
      configuration: "bpc_managed_match",
      return_url: "https://auth.example.com/manage",
    });
  });

  it("returns null without looking up configurations when the user has no mapping", async () => {
    let configurationLookups = 0;
    const service = createStripeBillingPortalService({
      customerService: {
        getStripeCustomerId: async () => null,
      },
      billingPortal: {
        configurations: {
          async *list() {
            configurationLookups += 1;
          },
        },
        sessions: {
          create: async () => ({ url: "https://billing.stripe.com/session" }),
        },
      },
    });

    assert.equal(
      await service.createPortalSession({
        userId: "user_without_customer",
        baseUrl: "https://auth.example.com",
      }),
      null,
    );
    assert.equal(configurationLookups, 0);
  });

  it("throws when no matching portal configuration exists", async () => {
    const service = createStripeBillingPortalService({
      customerService: {
        getStripeCustomerId: async () => "cus_123",
      },
      billingPortal: {
        configurations: {
          async *list() {},
        },
        sessions: {
          create: async () => ({ url: "https://billing.stripe.com/session" }),
        },
      },
    });

    await assert.rejects(
      service.createPortalSession({
        userId: "user_123",
        baseUrl: "https://auth.example.com",
      }),
      /No active Stripe Billing Portal configuration has the required features/,
    );
  });
});
