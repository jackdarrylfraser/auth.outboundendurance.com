import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const role = sqliteTable("role", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const userRole = sqliteTable(
  "user_role",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("user_role_user_id_role_id_unique").on(
      table.userId,
      table.roleId,
    ),
    index("user_role_role_id_idx").on(table.roleId),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const stripeCustomer = sqliteTable(
  "stripe_customer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("stripe_customer_user_id_unique").on(table.userId),
    uniqueIndex("stripe_customer_customerId_unique").on(
      table.stripeCustomerId,
    ),
  ],
);

export const stripeSubscription = sqliteTable(
  "stripe_subscription",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripeCustomerId: text("stripe_customer_id")
      .notNull()
      .references(() => stripeCustomer.stripeCustomerId, {
        onDelete: "cascade",
      }),
    status: text("status").notNull(),
    currentPeriodEnd: integer("current_period_end", {
      mode: "timestamp_ms",
    }).notNull(),
    lastEventCreatedAt: integer("last_event_created_at", {
      mode: "timestamp_ms",
    })
      .default(sql`0`)
      .notNull(),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" })
      .default(sql`0`)
      .notNull(),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .default(false)
      .notNull(),
    cancelAt: integer("cancel_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("stripe_subscription_stripeSubscriptionId_unique").on(
      table.stripeSubscriptionId,
    ),
    index("stripe_subscription_customer_status_idx").on(
      table.stripeCustomerId,
      table.status,
    ),
  ],
);

export const stripeEvent = sqliteTable("stripe_event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  eventCreatedAt: integer("event_created_at", {
    mode: "timestamp_ms",
  }).notNull(),
  payload: text("payload"),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
});

export const stripeCatalog = sqliteTable("stripe_catalog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  livemode: integer("livemode", { mode: "boolean" }).notNull(),
  stripeProductId: text("stripe_product_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  unitAmount: integer("unit_amount").notNull(),
  currency: text("currency").notNull(),
  interval: text("interval").notNull(),
  intervalCount: integer("interval_count").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("stripe_catalog_livemode_unique").on(table.livemode)]);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  roles: many(userRole),
  stripeCustomer: one(stripeCustomer),
}));

export const roleRelations = relations(role, ({ many }) => ({
  users: many(userRole),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
  user: one(user, {
    fields: [userRole.userId],
    references: [user.id],
  }),
  role: one(role, {
    fields: [userRole.roleId],
    references: [role.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const stripeCustomerRelations = relations(
  stripeCustomer,
  ({ one, many }) => ({
    user: one(user, {
      fields: [stripeCustomer.userId],
      references: [user.id],
    }),
    subscriptions: many(stripeSubscription),
  }),
);

export const stripeSubscriptionRelations = relations(
  stripeSubscription,
  ({ one }) => ({
    customer: one(stripeCustomer, {
      fields: [stripeSubscription.stripeCustomerId],
      references: [stripeCustomer.stripeCustomerId],
    }),
  }),
);
