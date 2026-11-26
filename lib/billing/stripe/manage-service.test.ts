import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStripeManageService } from "@/lib/billing/stripe/manage-service";

const activeSubscription = {
  id: "sub_active",
  customer: "cus_123",
  status: "active",
  items: { data: [{ current_period_end: 1_800_000_000 }] },
  cancel_at_period_end: false,
  cancel_at: null,
  default_payment_method: null,
};

const defaultCustomer = {
  id: "cus_123",
  invoice_settings: { default_payment_method: "pm_default" },
};

const defaultPaymentMethod = {
  id: "pm_default",
  type: "card",
  card: {
    brand: "visa",
    last4: "4242",
    exp_month: 12,
    exp_year: 2030,
  },
};

function createService(options: {
  subscriptions?: typeof activeSubscription[];
  setupIntent?: {
    customer: string | { id: string } | null;
    status: string;
    payment_method: string | { id: string } | null;
    metadata: { userId?: string };
  };
} = {}) {
  const calls: string[] = [];
let setupIntentCreateParams: {
  customer: string;
  usage: "off_session";
  allowed_payment_method_types: ["card"];
  metadata: { userId: string };
} | undefined;
let latestCancelAtPeriodEnd = activeSubscription.cancel_at_period_end;
  const service = createStripeManageService({
    customerService: {
      getStripeCustomerId: async () => "cus_123",
    },
    subscriptions: {
      syncSubscription: async () => {
        calls.push("sync-subscription");
      },
    },
    stripe: {
      customers: {
        retrieve: async () => defaultCustomer,
        update: async (_customerId, params) => {
          calls.push(`customer-default:${params.invoice_settings.default_payment_method}`);
        },
      },
      subscriptions: {
        list: async () => ({
          data: options.subscriptions ?? [activeSubscription],
          has_more: false,
        }),
        update: async (id, params) => {
          calls.push(`subscription-update:${id}`);
          latestCancelAtPeriodEnd =
            params.cancel_at_period_end ?? latestCancelAtPeriodEnd;
          return {
            ...activeSubscription,
            ...params,
          };
        },
      },
      setupIntents: {
        create: async (params) => {
          setupIntentCreateParams = params;
          return { client_secret: "seti_secret" };
        },
        retrieve: async () =>
          options.setupIntent ?? {
            customer: "cus_123",
            status: "succeeded",
            payment_method: "pm_new",
            metadata: { userId: "user_123" },
          },
      },
      paymentMethods: {
        retrieve: async () => defaultPaymentMethod,
      },
      invoices: {
        list: async () => ({
          data: [
            {
              id: "in_123",
              created: 1_700_000_000,
              total: 1200,
              amount_paid: 1200,
              currency: "usd",
              status: "paid",
              number: "INV-001",
              hosted_invoice_url: "https://invoice.stripe.com/in_123",
              invoice_pdf: "https://invoice.stripe.com/in_123.pdf",
            },
          ],
        }),
      },
    },
  });
  return {
    service,
    calls,
    getSetupIntentCreateParams: () => setupIntentCreateParams,
    getLatestCancelAtPeriodEnd: () => latestCancelAtPeriodEnd,
  };
}

describe("Stripe manage service", () => {
  it("loads the current payment method, subscription, and invoice history", async () => {
    const { service } = createService();
    const data = await service.getManagePageData("user_123");

    assert.deepEqual(data, {
      subscription: {
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(1_800_000_000_000).toISOString(),
        cancelAt: null,
      },
      paymentMethod: {
        type: "card",
        card: {
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
        },
      },
      invoices: [
        {
          id: "in_123",
          createdAt: new Date(1_700_000_000_000).toISOString(),
          total: 1200,
          amountPaid: 1200,
          currency: "usd",
          status: "paid",
          number: "INV-001",
          hostedInvoiceUrl: "https://invoice.stripe.com/in_123",
          invoicePdf: "https://invoice.stripe.com/in_123.pdf",
        },
      ],
    });
  });

  it("creates an off-session card SetupIntent for the mapped customer", async () => {
    const { service, getSetupIntentCreateParams } = createService();

    assert.deepEqual(await service.createPaymentMethodSetup("user_123"), {
      clientSecret: "seti_secret",
    });
    assert.deepEqual(getSetupIntentCreateParams(), {
      customer: "cus_123",
      usage: "off_session",
      allowed_payment_method_types: ["card"],
      metadata: { userId: "user_123" },
    });
  });

  it("sets a confirmed payment method as the customer and subscription default", async () => {
    const { service, calls } = createService();

    assert.equal(
      await service.confirmPaymentMethodSetup({
        userId: "user_123",
        setupIntentId: "seti_123",
      }),
      true,
    );
    assert.deepEqual(calls, [
      "customer-default:pm_new",
      "subscription-update:sub_active",
    ]);
  });

  it("rejects a SetupIntent that belongs to a different user", async () => {
    const { service, calls } = createService({
      setupIntent: {
        customer: "cus_123",
        status: "succeeded",
        payment_method: "pm_new",
        metadata: { userId: "other_user" },
      },
    });

    await assert.rejects(
      service.confirmPaymentMethodSetup({
        userId: "user_123",
        setupIntentId: "seti_123",
      }),
      /payment method setup could not be verified/,
    );
    assert.deepEqual(calls, []);
  });

  it("schedules cancellation at period end and synchronizes subscription state", async () => {
    const { service, calls, getLatestCancelAtPeriodEnd } = createService();

    const canceled = await service.cancelSubscription("user_123");

    assert.equal(canceled?.cancel_at_period_end, true);
    assert.equal(getLatestCancelAtPeriodEnd(), true);
    assert.deepEqual(calls, ["subscription-update:sub_active", "sync-subscription"]);
  });

  it("does not submit a duplicate cancellation update", async () => {
    const { service, calls } = createService({
      subscriptions: [
        { ...activeSubscription, cancel_at_period_end: true },
      ],
    });

    const subscription = await service.cancelSubscription("user_123");

    assert.equal(subscription?.cancel_at_period_end, true);
    assert.deepEqual(calls, []);
  });
});
