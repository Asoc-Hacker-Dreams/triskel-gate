CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`location` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`max_tickets` integer DEFAULT 1000,
	`status` text DEFAULT 'active',
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`event_id` integer NOT NULL,
	`customer_email` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text,
	`total_amount` real NOT NULL,
	`currency` text DEFAULT 'EUR',
	`status` text DEFAULT 'pending',
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`date` text NOT NULL,
	`tickets_sold` integer DEFAULT 0,
	`revenue` real DEFAULT 0,
	`refunds` real DEFAULT 0,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`category` text DEFAULT 'general',
	`description` text,
	`is_public` integer DEFAULT false,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'staff',
	`permissions` text,
	`is_active` integer DEFAULT true,
	`last_login_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ticket_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`stripe_product_id` text,
	`stripe_price_id` text,
	`max_quantity` integer DEFAULT 100,
	`sale_start_date` text NOT NULL,
	`sale_end_date` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`order_id` integer NOT NULL,
	`ticket_type_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`qr_code` text NOT NULL,
	`ticket_number` text NOT NULL,
	`holder_name` text,
	`holder_email` text,
	`price` real NOT NULL,
	`is_used` integer DEFAULT false,
	`used_at` text,
	`used_by` text,
	`checkin_location` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_type_id`) REFERENCES `ticket_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `validation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`staff_id` integer,
	`action` text NOT NULL,
	`location` text,
	`device_info` text,
	`ip_address` text,
	`success` integer NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_order_number_idx` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `sales_stats_event_date_idx` ON `sales_stats` (`event_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_uuid_unique` ON `tickets` (`uuid`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_qr_code_unique` ON `tickets` (`qr_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ticket_number_unique` ON `tickets` (`ticket_number`);--> statement-breakpoint
CREATE INDEX `tickets_uuid_idx` ON `tickets` (`uuid`);--> statement-breakpoint
CREATE INDEX `tickets_qr_code_idx` ON `tickets` (`qr_code`);--> statement-breakpoint
CREATE INDEX `tickets_ticket_number_idx` ON `tickets` (`ticket_number`);--> statement-breakpoint
CREATE INDEX `tickets_order_idx` ON `tickets` (`order_id`);--> statement-breakpoint
CREATE INDEX `tickets_used_idx` ON `tickets` (`is_used`);--> statement-breakpoint
CREATE INDEX `tickets_event_idx` ON `tickets` (`event_id`);