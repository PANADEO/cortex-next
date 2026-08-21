CREATE TABLE IF NOT EXISTS "system_config"."application_translations" (
	"application_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_translations_application_id_locale_pk" PRIMARY KEY("application_id","locale")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."application_translations" ADD CONSTRAINT "application_translations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "system_config"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
