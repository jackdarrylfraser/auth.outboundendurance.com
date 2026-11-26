type PaymentMethod = {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
};

type Customer = {
  id: string;
  deleted?: unknown;
  invoice_settings?: {
    default_payment_method: string | PaymentMethod | null;
  };
};

type Subscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  items: { data: Array<{ current_period_end: number }> };
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  default_payment_method: string | PaymentMethod | null;
};

type Invoice = {
  id: string;
  created: number;
  total: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  number?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
};

type CustomerService = {
  getStripeCustomerId(userId: string): Promise<string | null>;
};

type SubscriptionService = {
  syncSubscription(subscription: Subscription): Promise<void>;
};

type StripeManageOperations = {
  customers: {
    retrieve(
      customerId: string,
      params: { expand: string[] },
    ): Promise<Customer>;
    update(
      customerId: string,
      params: {
        invoice_settings: { default_payment_method: string };
      },
    ): Promise<unknown>;
  };
  subscriptions: {
    list(params: {
      customer: string;
      status: "all";
      limit: number;
      expand: string[];
    }): Promise<{ data: Subscription[]; has_more: boolean }>;
    update(
      subscriptionId: string,
      params: {
        cancel_at_period_end?: boolean;
        default_payment_method?: string;
      },
    ): Promise<Subscription>;
  };
  setupIntents: {
    create(params: {
      customer: string;
      usage: "off_session";
      allowed_payment_method_types: ["card"];
      metadata: { userId: string };
    }): Promise<{ client_secret: string | null }>;
    retrieve(setupIntentId: string): Promise<{
      customer: string | { id: string } | null;
      status: string;
      payment_method: string | { id: string } | null;
      metadata: { userId?: string } | null;
    }>;
  };
  paymentMethods: {
    retrieve(paymentMethodId: string): Promise<PaymentMethod>;
  };
  invoices: {
    list(params: {
      customer: string;
      limit: number;
    }): Promise<{ data: Invoice[] }>;
  };
};

export class PaymentSetupVerificationError extends Error {
  constructor() {
    super("The payment method setup could not be verified.");
    this.name = "PaymentSetupVerificationError";
  }
}

const manageableStatuses = new Set([
  "active",
  "trialing",
  "unpaid",
  "past_due",
  "paused",
]);

function getSubscriptionPeriodEnd(subscription: Subscription): number {
  const periodEnds = subscription.items.data.map(
    (item) => item.current_period_end,
  );
  if (periodEnds.length === 0) {
    throw new Error(
      `Stripe subscription ${subscription.id} has no subscription items.`,
    );
  }
  return Math.max(...periodEnds);
}

function isManageableSubscription(
  subscription: Subscription,
  now: Date,
): boolean {
  if (manageableStatuses.has(subscription.status)) {
    return true;
  }

  return (
    subscription.status === "canceled" &&
    getSubscriptionPeriodEnd(subscription) * 1000 > now.getTime()
  );
}

function getPaymentMethodId(
  paymentMethod: string | { id: string } | null,
): string | null {
  return typeof paymentMethod === "string" ? paymentMethod : paymentMethod?.id ?? null;
}

function getStripeCustomerIdFromReference(
  customer: string | { id: string } | null,
): string | null {
  return typeof customer === "string" ? customer : customer?.id ?? null;
}

export function createStripeManageService(dependencies: {
  customerService: CustomerService;
  subscriptions: SubscriptionService;
  stripe: StripeManageOperations;
}) {
  async function getCustomerId(userId: string): Promise<string | null> {
    return dependencies.customerService.getStripeCustomerId(userId);
  }

  async function listCustomerSubscriptions(customerId: string) {
    const subscriptions = await dependencies.stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.has_more) {
      throw new Error(
        "Unable to safely manage this account because it has more than 100 Stripe subscriptions.",
      );
    }

    return subscriptions.data;
  }

  function getCurrentSubscription(
    subscriptions: Subscription[],
    now = new Date(),
  ): Subscription | null {
    const manageable = subscriptions.filter((subscription) =>
      isManageableSubscription(subscription, now),
    );
    if (manageable.length > 1) {
      throw new Error(
        "More than one manageable Stripe subscription is associated with this account.",
      );
    }
    return manageable[0] ?? null;
  }

  async function getManagePageData(userId: string) {
    const customerId = await getCustomerId(userId);
    if (!customerId) {
      return null;
    }

    const [customer, subscriptions, invoices] = await Promise.all([
      dependencies.stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      }),
      listCustomerSubscriptions(customerId),
      dependencies.stripe.invoices.list({ customer: customerId, limit: 10 }),
    ]);

    if (customer.deleted) {
      throw new Error(`Stripe customer ${customerId} has been deleted.`);
    }

    const subscription = getCurrentSubscription(subscriptions);
    if (!subscription) {
      return null;
    }

    const paymentMethodReference =
      subscription.default_payment_method ??
      customer.invoice_settings?.default_payment_method ??
      null;
    const paymentMethodId = getPaymentMethodId(paymentMethodReference);
    const paymentMethod =
      typeof paymentMethodReference === "object" && paymentMethodReference
        ? paymentMethodReference
        : paymentMethodId
          ? await dependencies.stripe.paymentMethods.retrieve(paymentMethodId)
          : null;

    return {
      subscription: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(
          getSubscriptionPeriodEnd(subscription) * 1000,
        ).toISOString(),
        cancelAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null,
      },
      paymentMethod: paymentMethod
        ? {
            type: paymentMethod.type,
            card: paymentMethod.card
              ? {
                  brand: paymentMethod.card.brand,
                  last4: paymentMethod.card.last4,
                  expMonth: paymentMethod.card.exp_month,
                  expYear: paymentMethod.card.exp_year,
                }
              : null,
          }
        : null,
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        createdAt: new Date(invoice.created * 1000).toISOString(),
        total: invoice.total,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        number: invoice.number,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
    };
  }

  async function createPaymentMethodSetup(userId: string) {
    const customerId = await getCustomerId(userId);
    if (!customerId) {
      return null;
    }

    const setupIntent = await dependencies.stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      allowed_payment_method_types: ["card"],
      metadata: { userId },
    });
    if (!setupIntent.client_secret) {
      throw new Error("Stripe did not return a payment setup secret.");
    }

    return { clientSecret: setupIntent.client_secret };
  }

  async function confirmPaymentMethodSetup(input: {
    userId: string;
    setupIntentId: string;
  }): Promise<boolean> {
    const customerId = await getCustomerId(input.userId);
    if (!customerId) {
      return false;
    }

    const setupIntent = await dependencies.stripe.setupIntents.retrieve(
      input.setupIntentId,
    );
    if (
      setupIntent.metadata?.userId !== input.userId ||
      getStripeCustomerIdFromReference(setupIntent.customer) !== customerId ||
      setupIntent.status !== "succeeded"
    ) {
      throw new PaymentSetupVerificationError();
    }

    const paymentMethodId = getPaymentMethodId(setupIntent.payment_method);
    if (!paymentMethodId) {
      throw new PaymentSetupVerificationError();
    }

    const subscriptions = await listCustomerSubscriptions(customerId);
    const updateableSubscriptions = subscriptions.filter(
      (subscription) =>
        subscription.status !== "canceled" &&
        subscription.status !== "incomplete_expired",
    );

    await dependencies.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await Promise.all(
      updateableSubscriptions.map((subscription) =>
        dependencies.stripe.subscriptions.update(subscription.id, {
          default_payment_method: paymentMethodId,
        }),
      ),
    );

    return true;
  }

  async function cancelSubscription(userId: string) {
    const customerId = await getCustomerId(userId);
    if (!customerId) {
      return null;
    }

    const subscriptions = await listCustomerSubscriptions(customerId);
    const subscription = getCurrentSubscription(subscriptions);
    if (!subscription) {
      return null;
    }

    if (subscription.cancel_at_period_end) {
      return subscription;
    }

    const updatedSubscription = await dependencies.stripe.subscriptions.update(
      subscription.id,
      { cancel_at_period_end: true },
    );
    await dependencies.subscriptions.syncSubscription(updatedSubscription);
    return updatedSubscription;
  }

  return {
    getManagePageData,
    createPaymentMethodSetup,
    confirmPaymentMethodSetup,
    cancelSubscription,
  };
}

export type StripeManagePageData = Awaited<
  ReturnType<ReturnType<typeof createStripeManageService>["getManagePageData"]>
>;
