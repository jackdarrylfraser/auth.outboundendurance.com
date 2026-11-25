CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `stripe_catalog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`livemode` integer NOT NULL,
	`stripe_product_id` text NOT NULL,
	`stripe_price_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit_amount` integer NOT NULL,
	`currency` text NOT NULL,
	`interval` text NOT NULL,
	`interval_count` integer NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_catalog_livemode_unique` ON `stripe_catalog` (`livemode`);--> statement-breakpoint
CREATE TABLE `stripe_customer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customer_user_id_unique` ON `stripe_customer` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customer_customerId_unique` ON `stripe_customer` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `stripe_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stripe_event_id` text NOT NULL,
	`type` text NOT NULL,
	`event_created_at` integer NOT NULL,
	`payload` text,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_event_stripe_event_id_unique` ON `stripe_event` (`stripe_event_id`);--> statement-breakpoint
CREATE TABLE `stripe_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer NOT NULL,
	`last_event_created_at` integer DEFAULT 0 NOT NULL,
	`last_synced_at` integer DEFAULT 0 NOT NULL,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`cancel_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`stripe_customer_id`) REFERENCES `stripe_customer`(`stripe_customer_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_subscription_stripeSubscriptionId_unique` ON `stripe_subscription` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `stripe_subscription_customer_status_idx` ON `stripe_subscription` (`stripe_customer_id`,`status`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);