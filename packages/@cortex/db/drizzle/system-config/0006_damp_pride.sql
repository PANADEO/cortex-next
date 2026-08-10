CREATE TABLE IF NOT EXISTS "system_config"."instance_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"appearance_preset" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_settings_singleton" CHECK ("system_config"."instance_settings"."id")
);
