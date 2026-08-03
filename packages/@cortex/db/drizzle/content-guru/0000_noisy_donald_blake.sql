CREATE SCHEMA "content_guru";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"profile_name" text NOT NULL,
	"history" text,
	"description" text,
	"products" text,
	"offer" text,
	"use_cases" text,
	"experience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_user_email_profile_name_unique" UNIQUE("user_email","profile_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."content_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"content_type" text NOT NULL,
	"topic" text,
	"generated_content" text NOT NULL,
	"status" text DEFAULT 'done' NOT NULL,
	"matched_forbidden_phrases" text[],
	"target_audience" text,
	"additional_info" text,
	"keyword_phrase" text,
	"meta_description" text,
	"model_used" text NOT NULL,
	"client_profile_id" uuid,
	"market_profile_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_archive_status_allowed" CHECK ("content_guru"."content_archive"."status" in ('done', 'done-with-warnings'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."forbidden_phrases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"phrase" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "generation_jobs_mode_allowed" CHECK ("content_guru"."generation_jobs"."mode" in ('batch', 'package')),
	CONSTRAINT "generation_jobs_status_allowed" CHECK ("content_guru"."generation_jobs"."status" in ('queued', 'running', 'done', 'done-with-errors'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."market_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"profile_name" text NOT NULL,
	"description" text,
	"size_trends" text,
	"personas" text,
	"problems" text,
	"needs" text,
	"plans" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_profiles_user_email_profile_name_unique" UNIQUE("user_email","profile_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_guru"."templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Główne' NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_category_name_unique" UNIQUE("category","name")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_guru"."content_archive" ADD CONSTRAINT "content_archive_client_profile_id_client_profiles_id_fk" FOREIGN KEY ("client_profile_id") REFERENCES "content_guru"."client_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_guru"."content_archive" ADD CONSTRAINT "content_archive_market_profile_id_market_profiles_id_fk" FOREIGN KEY ("market_profile_id") REFERENCES "content_guru"."market_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_profiles_user_email_idx" ON "content_guru"."client_profiles" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_archive_user_email_created_at_idx" ON "content_guru"."content_archive" USING btree ("user_email","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forbidden_phrases_user_email_idx" ON "content_guru"."forbidden_phrases" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_jobs_user_email_created_at_idx" ON "content_guru"."generation_jobs" USING btree ("user_email","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_profiles_user_email_idx" ON "content_guru"."market_profiles" USING btree ("user_email");