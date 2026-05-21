CREATE TABLE IF NOT EXISTS "passkey_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"credential_id" text NOT NULL,
	"user_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text,
	"backed_up" boolean DEFAULT false,
	"transports" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_id_uidx" ON "passkey_credentials" USING btree ("credential_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passkey_user_id_idx" ON "passkey_credentials" USING btree ("user_id");
