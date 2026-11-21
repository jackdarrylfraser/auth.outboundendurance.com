CREATE TABLE `stripe_catalog` (
	`livemode` integer PRIMARY KEY NOT NULL,
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
