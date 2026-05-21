--liquibase formatted sql

--changeset system:001-tables splitStatements:true endDelimiter:;
CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"location" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"max_tickets" integer DEFAULT 1000,
	"status" text DEFAULT 'active',
	"is_agorapass_integrated" boolean DEFAULT false,
	"agorapass_event_id" text,
	"platform_fee_percent" real DEFAULT 3,
	"organizer_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"organizer_id" integer NOT NULL,
	"event_id" integer,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"subtotal" real NOT NULL,
	"platform_fees" real NOT NULL,
	"stripe_fees" real NOT NULL,
	"tax_amount" real DEFAULT 0,
	"total_to_pay" real NOT NULL,
	"currency" text DEFAULT 'EUR',
	"status" text DEFAULT 'draft',
	"paid_at" timestamp with time zone,
	"payment_method" text,
	"pdf_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"event_id" integer NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"subtotal" real NOT NULL,
	"platform_fee" real DEFAULT 0 NOT NULL,
	"stripe_fee" real DEFAULT 0 NOT NULL,
	"total_amount" real NOT NULL,
	"currency" text DEFAULT 'EUR',
	"status" text DEFAULT 'pending',
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
CREATE TABLE IF NOT EXISTS "organizers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"tax_id" text,
	"billing_address" text,
	"country" text DEFAULT 'ES',
	"currency" text DEFAULT 'EUR',
	"payout_method" text,
	"payout_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizers_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "platform_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"order_id" integer,
	"fee_type" text NOT NULL,
	"fee_percent" real NOT NULL,
	"base_amount" real NOT NULL,
	"fee_amount" real NOT NULL,
	"currency" text DEFAULT 'EUR',
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "sales_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"tickets_sold" integer DEFAULT 0,
	"gross_revenue" real DEFAULT 0,
	"platform_fees" real DEFAULT 0,
	"stripe_fees" real DEFAULT 0,
	"net_revenue" real DEFAULT 0,
	"refunds" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text DEFAULT 'general',
	"description" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
CREATE TABLE IF NOT EXISTS "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"auth_provider" text DEFAULT 'supabase',
	"auth_provider_id" text,
	"role" text DEFAULT 'staff',
	"permissions" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizer_id" integer NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"plan_name" text DEFAULT 'Free',
	"status" text DEFAULT 'active',
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" real NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"max_quantity" integer DEFAULT 100,
	"sale_start_date" timestamp with time zone NOT NULL,
	"sale_end_date" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"order_id" integer NOT NULL,
	"ticket_type_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"qr_code" text NOT NULL,
	"ticket_number" text NOT NULL,
	"holder_name" text,
	"holder_email" text,
	"price" real NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp with time zone,
	"used_by" text,
	"checkin_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "tickets_qr_code_unique" UNIQUE("qr_code"),
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
CREATE TABLE IF NOT EXISTS "validation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"staff_id" integer,
	"action" text NOT NULL,
	"location" text,
	"device_info" text,
	"ip_address" text,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--rollback DROP TABLE IF EXISTS "validation_logs"; DROP TABLE IF EXISTS "tickets"; DROP TABLE IF EXISTS "ticket_types"; DROP TABLE IF EXISTS "subscriptions"; DROP TABLE IF EXISTS "staff"; DROP TABLE IF EXISTS "settings"; DROP TABLE IF EXISTS "sales_stats"; DROP TABLE IF EXISTS "platform_fees"; DROP TABLE IF EXISTS "organizers"; DROP TABLE IF EXISTS "orders"; DROP TABLE IF EXISTS "invoices"; DROP TABLE IF EXISTS "events";

--changeset system:001-indexes splitStatements:true endDelimiter:;
CREATE INDEX IF NOT EXISTS "invoices_organizer_idx" ON "invoices" ("organizer_id");
CREATE INDEX IF NOT EXISTS "invoices_event_idx" ON "invoices" ("event_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX IF NOT EXISTS "invoices_period_idx" ON "invoices" ("period_start","period_end");
CREATE INDEX IF NOT EXISTS "orders_email_idx" ON "orders" ("customer_email");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "orders_order_number_idx" ON "orders" ("order_number");
CREATE INDEX IF NOT EXISTS "platform_fees_event_idx" ON "platform_fees" ("event_id");
CREATE INDEX IF NOT EXISTS "platform_fees_order_idx" ON "platform_fees" ("order_id");
CREATE INDEX IF NOT EXISTS "platform_fees_status_idx" ON "platform_fees" ("status");
CREATE INDEX IF NOT EXISTS "sales_stats_event_date_idx" ON "sales_stats" ("event_id","date");
CREATE INDEX IF NOT EXISTS "subscriptions_organizer_idx" ON "subscriptions" ("organizer_id");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_sub_idx" ON "subscriptions" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "tickets_uuid_idx" ON "tickets" ("uuid");
CREATE INDEX IF NOT EXISTS "tickets_qr_code_idx" ON "tickets" ("qr_code");
CREATE INDEX IF NOT EXISTS "tickets_ticket_number_idx" ON "tickets" ("ticket_number");
CREATE INDEX IF NOT EXISTS "tickets_order_idx" ON "tickets" ("order_id");
CREATE INDEX IF NOT EXISTS "tickets_used_idx" ON "tickets" ("is_used");
CREATE INDEX IF NOT EXISTS "tickets_event_idx" ON "tickets" ("event_id");
--rollback DROP INDEX IF EXISTS "tickets_event_idx"; DROP INDEX IF EXISTS "tickets_used_idx"; DROP INDEX IF EXISTS "tickets_order_idx"; DROP INDEX IF EXISTS "tickets_ticket_number_idx"; DROP INDEX IF EXISTS "tickets_qr_code_idx"; DROP INDEX IF EXISTS "tickets_uuid_idx"; DROP INDEX IF EXISTS "subscriptions_stripe_sub_idx"; DROP INDEX IF EXISTS "subscriptions_organizer_idx"; DROP INDEX IF EXISTS "sales_stats_event_date_idx"; DROP INDEX IF EXISTS "platform_fees_status_idx"; DROP INDEX IF EXISTS "platform_fees_order_idx"; DROP INDEX IF EXISTS "platform_fees_event_idx"; DROP INDEX IF EXISTS "orders_order_number_idx"; DROP INDEX IF EXISTS "orders_status_idx"; DROP INDEX IF EXISTS "orders_email_idx"; DROP INDEX IF EXISTS "invoices_period_idx"; DROP INDEX IF EXISTS "invoices_status_idx"; DROP INDEX IF EXISTS "invoices_event_idx"; DROP INDEX IF EXISTS "invoices_organizer_idx";

--changeset system:001-fk-constraints splitStatements:false
DO $$
BEGIN
  BEGIN
    ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "platform_fees" ADD CONSTRAINT "platform_fees_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "sales_stats" ADD CONSTRAINT "sales_stats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "validation_logs" ADD CONSTRAINT "validation_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE "validation_logs" ADD CONSTRAINT "validation_logs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE no action ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
--rollback ALTER TABLE "validation_logs" DROP CONSTRAINT IF EXISTS "validation_logs_staff_id_staff_id_fk"; ALTER TABLE "validation_logs" DROP CONSTRAINT IF EXISTS "validation_logs_ticket_id_tickets_id_fk"; ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_event_id_events_id_fk"; ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_ticket_type_id_ticket_types_id_fk"; ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_order_id_orders_id_fk"; ALTER TABLE "ticket_types" DROP CONSTRAINT IF EXISTS "ticket_types_event_id_events_id_fk"; ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_organizer_id_organizers_id_fk"; ALTER TABLE "sales_stats" DROP CONSTRAINT IF EXISTS "sales_stats_event_id_events_id_fk"; ALTER TABLE "platform_fees" DROP CONSTRAINT IF EXISTS "platform_fees_order_id_orders_id_fk"; ALTER TABLE "platform_fees" DROP CONSTRAINT IF EXISTS "platform_fees_event_id_events_id_fk"; ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_event_id_events_id_fk"; ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_event_id_events_id_fk"; ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_organizer_id_organizers_id_fk"; ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_organizer_id_organizers_id_fk";
