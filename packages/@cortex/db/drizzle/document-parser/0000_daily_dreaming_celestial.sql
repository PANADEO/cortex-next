CREATE SCHEMA "document_parser";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_parser"."jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"backend_job_id" text,
	"user_email" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"model" text,
	"markdown" text,
	"error_message" text,
	"error_code" text,
	"page_count" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"elapsed_seconds" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "jobs_status_allowed" CHECK ("document_parser"."jobs"."status" in ('queued', 'processing', 'done', 'error')),
	CONSTRAINT "jobs_error_code_allowed" CHECK ("document_parser"."jobs"."error_code" is null or "document_parser"."jobs"."error_code" in (
        'unsupported-format', 'file-too-large', 'conversion-failed',
        'vision-call-failed', 'page-limit-exceeded'
      ))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_user_email_created_at_idx" ON "document_parser"."jobs" USING btree ("user_email","created_at");