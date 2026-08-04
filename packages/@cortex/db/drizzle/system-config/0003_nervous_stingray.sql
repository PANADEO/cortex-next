CREATE TABLE IF NOT EXISTS "system_config"."openwebui_group_mappings" (
	"role_id" uuid PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"group_name" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."openwebui_group_mappings" ADD CONSTRAINT "openwebui_group_mappings_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "system_config"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
