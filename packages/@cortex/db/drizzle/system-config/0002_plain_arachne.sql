ALTER TABLE "system_config"."applications" ADD COLUMN "show_on_hub" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "system_config"."applications" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "system_config"."applications" ADD COLUMN "category_functional" text;--> statement-breakpoint
ALTER TABLE "system_config"."applications" ADD COLUMN "category_department" text[];--> statement-breakpoint
ALTER TABLE "system_config"."applications" ADD COLUMN "activated_at" timestamp with time zone;