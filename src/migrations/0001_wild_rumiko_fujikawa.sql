CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_number` text NOT NULL,
	`organizer_id` integer NOT NULL,
	`event_id` integer,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`subtotal` real NOT NULL,
	`platform_fees` real NOT NULL,
	`stripe_fees` real NOT NULL,
	`tax_amount` real DEFAULT 0,
	`total_to_pay` real NOT NULL,
	`currency` text DEFAULT 'EUR',
	`status` text DEFAULT 'draft',
	`paid_at` text,
	`payment_method` text,
	`pdf_url` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`tax_id` text,
	`billing_address` text,
	`country` text DEFAULT 'ES',
	`currency` text DEFAULT 'EUR',
	`payout_method` text,
	`payout_details` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_fees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`order_id` integer,
	`fee_type` text NOT NULL,
	`fee_percent` real NOT NULL,
	`base_amount` real NOT NULL,
	`fee_amount` real NOT NULL,
	`currency` text DEFAULT 'EUR',
	`status` text DEFAULT 'pending',
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE events ADD `is_agorapass_integrated` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE events ADD `agorapass_event_id` text;--> statement-breakpoint
ALTER TABLE events ADD `platform_fee_percent` real DEFAULT 3;--> statement-breakpoint
ALTER TABLE events ADD `organizer_id` integer REFERENCES organizers(id);--> statement-breakpoint
ALTER TABLE orders ADD `subtotal` real NOT NULL;--> statement-breakpoint
ALTER TABLE orders ADD `platform_fee` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE orders ADD `stripe_fee` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE sales_stats ADD `gross_revenue` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE sales_stats ADD `platform_fees` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE sales_stats ADD `stripe_fees` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE sales_stats ADD `net_revenue` real DEFAULT 0;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_organizer_idx` ON `invoices` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `invoices_event_idx` ON `invoices` (`event_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_period_idx` ON `invoices` (`period_start`,`period_end`);--> statement-breakpoint
CREATE UNIQUE INDEX `organizers_email_unique` ON `organizers` (`email`);--> statement-breakpoint
CREATE INDEX `platform_fees_event_idx` ON `platform_fees` (`event_id`);--> statement-breakpoint
CREATE INDEX `platform_fees_order_idx` ON `platform_fees` (`order_id`);--> statement-breakpoint
CREATE INDEX `platform_fees_status_idx` ON `platform_fees` (`status`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
ALTER TABLE `sales_stats` DROP COLUMN `revenue`;