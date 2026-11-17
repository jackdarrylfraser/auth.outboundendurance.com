DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "stripe_customer_customerId_unique";--> statement-breakpoint
DROP INDEX "stripe_subscription_customer_status_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `stripe_event` ALTER COLUMN "processed_at" TO "processed_at" integer;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customer_customerId_unique` ON `stripe_customer` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `stripe_subscription_customer_status_idx` ON `stripe_subscription` (`stripe_customer_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `stripe_event` ADD `payload` text;