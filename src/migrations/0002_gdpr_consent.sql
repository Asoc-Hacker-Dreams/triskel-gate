CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"consent_type" text NOT NULL,
	"granted" boolean NOT NULL DEFAULT false,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"method" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tg_consents_email" ON "user_consents" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tg_consents_user_type" ON "user_consents" USING btree ("user_id","consent_type");
