import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripeCatalog } from "@/lib/db/schema";
import { infrastructure } from "@/lib/infrastructure/runtime";
import {
  assertStripeSubscriptionDefinitionIsConfigured,
  getStripeLivemode,
  STRIPE_CATALOG_MANAGED_BY,
  STRIPE_SUBSCRIPTION_CATALOG_KEY,
  stripeSubscriptionDefinition,
} from "@/lib/billing/stripe/catalog-definition";

const { db, stripe, env } = infrastructure;
const livemode = getStripeLivemode(env.STRIPE_SECRET_KEY);

const catalogMetadata = {
  managed_by: STRIPE_CATALOG_MANAGED_BY,
  catalog_key: STRIPE_SUBSCRIPTION_CATALOG_KEY,
};

function isMatchingPrice(price: Stripe.Price, productId: string): boolean {
  const { price: definition } = stripeSubscriptionDefinition;
  return (
    price.product === productId &&
    price.active &&
    price.type === "recurring" &&
    price.unit_amount === definition.unitAmount &&
    price.currency === definition.currency &&
    price.recurring?.interval === definition.interval &&
    price.recurring.interval_count === definition.intervalCount
  );
}

async function findProductByCatalogKeyOrName(): Promise<Stripe.Product | null> {
  const keyedProducts: Stripe.Product[] = [];
  const namedProducts: Stripe.Product[] = [];

  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata.catalog_key === STRIPE_SUBSCRIPTION_CATALOG_KEY) {
      keyedProducts.push(product);
    } else if (
      !product.metadata.catalog_key &&
      !product.metadata.managed_by &&
      product.name === stripeSubscriptionDefinition.product.name
    ) {
      namedProducts.push(product);
    }
  }

  const matches = keyedProducts.length > 0 ? keyedProducts : namedProducts;
  if (matches.length > 1) {
    throw new Error(
      `Found multiple Stripe products for "${stripeSubscriptionDefinition.product.name}". Resolve the duplicate products before syncing.`,
    );
  }

  return matches[0] ?? null;
}

async function resolveProduct(
  existingCatalog: typeof stripeCatalog.$inferSelect | undefined,
): Promise<Stripe.Product> {
  let product: Stripe.Product;

  if (existingCatalog) {
    const retrievedProduct = await stripe.products.retrieve(
      existingCatalog.stripeProductId,
    );
    if ("deleted" in retrievedProduct && retrievedProduct.deleted) {
      throw new Error(
        `The synchronized Stripe product ${existingCatalog.stripeProductId} was deleted.`,
      );
    }
    if (
      retrievedProduct.metadata.catalog_key &&
      retrievedProduct.metadata.catalog_key !== STRIPE_SUBSCRIPTION_CATALOG_KEY
    ) {
      throw new Error(
        `The synchronized Stripe product ${retrievedProduct.id} has a different catalog key.`,
      );
    }
    product = retrievedProduct;
  } else {
    product = (await findProductByCatalogKeyOrName()) ??
      (await stripe.products.create(
        {
          name: stripeSubscriptionDefinition.product.name,
          description: stripeSubscriptionDefinition.product.description ?? "",
          active: true,
          metadata: catalogMetadata,
        },
        {
          idempotencyKey: `outboundendurance-product-${livemode ? "live" : "test"}`,
        },
      ));
  }

  if (product.livemode !== livemode) {
    throw new Error(`Stripe product ${product.id} is in the wrong Stripe mode.`);
  }

  return stripe.products.update(product.id, {
    active: true,
    name: stripeSubscriptionDefinition.product.name,
    description: stripeSubscriptionDefinition.product.description ?? "",
    metadata: {
      ...product.metadata,
      ...catalogMetadata,
    },
  });
}

async function resolvePrice(
  product: Stripe.Product,
  existingCatalog: typeof stripeCatalog.$inferSelect | undefined,
): Promise<Stripe.Price> {
  if (existingCatalog) {
    const savedPrice = await stripe.prices.retrieve(
      existingCatalog.stripePriceId,
    );
    if (savedPrice.product !== product.id) {
      throw new Error(
        `The synchronized Stripe Price ${savedPrice.id} belongs to a different product.`,
      );
    }
    if (savedPrice.livemode !== livemode) {
      throw new Error(`Stripe Price ${savedPrice.id} is in the wrong Stripe mode.`);
    }
    if (isMatchingPrice(savedPrice, product.id)) {
      return stripe.prices.update(savedPrice.id, {
        metadata: {
          ...savedPrice.metadata,
          ...catalogMetadata,
        },
      });
    }
  }

  const matchingPrices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    active: true,
    limit: 100,
    product: product.id,
  })) {
    if (isMatchingPrice(price, product.id)) {
      matchingPrices.push(price);
    }
  }

  if (matchingPrices.length > 1) {
    throw new Error(
      `Found multiple active Stripe Prices matching the code-defined subscription for product ${product.id}. Resolve the duplicates before syncing.`,
    );
  }

  if (matchingPrices[0]) {
    return stripe.prices.update(matchingPrices[0].id, {
      metadata: {
        ...matchingPrices[0].metadata,
        ...catalogMetadata,
      },
    });
  }

  const { price: definition } = stripeSubscriptionDefinition;
  const priceFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        unitAmount: definition.unitAmount,
        currency: definition.currency,
        interval: definition.interval,
        intervalCount: definition.intervalCount,
      }),
    )
    .digest("hex")
    .slice(0, 24);

  return stripe.prices.create(
    {
      product: product.id,
      unit_amount: definition.unitAmount,
      currency: definition.currency,
      recurring: {
        interval: definition.interval,
        interval_count: definition.intervalCount,
      },
      metadata: catalogMetadata,
    },
    {
      idempotencyKey: `outboundendurance-price-${livemode ? "live" : "test"}-${priceFingerprint}`,
    },
  );
}

async function main(): Promise<void> {
  assertStripeSubscriptionDefinitionIsConfigured();

  const [existingCatalog] = await db
    .select()
    .from(stripeCatalog)
    .where(eq(stripeCatalog.livemode, livemode))
    .limit(1);

  const product = await resolveProduct(existingCatalog);
  const price = await resolvePrice(product, existingCatalog);
  const { product: productDefinition, price: priceDefinition } =
    stripeSubscriptionDefinition;

  await db
    .insert(stripeCatalog)
    .values({
      livemode,
      stripeProductId: product.id,
      stripePriceId: price.id,
      name: productDefinition.name,
      description: productDefinition.description,
      unitAmount: priceDefinition.unitAmount,
      currency: priceDefinition.currency,
      interval: priceDefinition.interval,
      intervalCount: priceDefinition.intervalCount,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: stripeCatalog.livemode,
      set: {
        stripeProductId: product.id,
        stripePriceId: price.id,
        name: productDefinition.name,
        description: productDefinition.description,
        unitAmount: priceDefinition.unitAmount,
        currency: priceDefinition.currency,
        interval: priceDefinition.interval,
        intervalCount: priceDefinition.intervalCount,
        syncedAt: new Date(),
      },
    });

  console.info(
    `Stripe subscription product ${product.id} and price ${price.id} are synchronized for ${livemode ? "live" : "test"} mode.`,
  );
}

await main();
