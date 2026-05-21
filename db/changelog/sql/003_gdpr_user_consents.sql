--liquibase formatted sql

--changeset system:003-gdpr-consents splitStatements:true endDelimiter:;
CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"consent_type" text NOT NULL CHECK (consent_type IN ('essential', 'analytics', 'marketing', 'newsletters', 'product_updates', 'partner_promos')),
	"granted" boolean NOT NULL DEFAULT false,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"method" text NOT NULL CHECK (method IN ('signup', 'banner', 'profile', 'import', 'api')),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_consent_granted_at" CHECK (
		(granted = false) OR (granted = true AND granted_at IS NOT NULL)
	)
);
CREATE INDEX IF NOT EXISTS "idx_tg_consents_email" ON "user_consents" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tg_consents_user_type" ON "user_consents" ("user_id", "consent_type") WHERE user_id IS NOT NULL;
--rollback DROP INDEX IF EXISTS "idx_tg_consents_user_type"; DROP INDEX IF EXISTS "idx_tg_consents_email"; DROP TABLE IF EXISTS "user_consents";
