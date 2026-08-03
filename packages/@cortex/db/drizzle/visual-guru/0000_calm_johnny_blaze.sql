CREATE SCHEMA "visual_guru";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_guru"."generation_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"variant_index" integer NOT NULL,
	"image" "bytea" NOT NULL,
	"content_type" text DEFAULT 'image/png' NOT NULL,
	CONSTRAINT "generation_variants_generation_index_unique" UNIQUE("generation_id","variant_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visual_guru"."generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"prompt" text NOT NULL,
	"additional_context" text,
	"had_reference_image" boolean DEFAULT false NOT NULL,
	"reference_image_file_name" text,
	"model" text NOT NULL,
	"variant_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visual_guru"."generation_variants" ADD CONSTRAINT "generation_variants_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "visual_guru"."generations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generations_user_email_created_at_idx" ON "visual_guru"."generations" USING btree ("user_email","created_at");