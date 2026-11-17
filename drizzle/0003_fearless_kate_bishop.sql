ALTER TABLE `stripe_subscription` ADD `last_event_created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_subscription` ADD `last_synced_at` integer DEFAULT 0 NOT NULL;