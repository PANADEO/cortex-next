CREATE SCHEMA "geo_score_calculator";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geo_score_calculator"."calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"text_content" text NOT NULL,
	"text_preview" text NOT NULL,
	"word_count" integer NOT NULL,
	"total_score" double precision NOT NULL,
	"grade" text NOT NULL,
	"stats_score" double precision NOT NULL,
	"verbs_score" double precision NOT NULL,
	"structure_score" double precision NOT NULL,
	"objectivity_score" double precision NOT NULL,
	"result" jsonb NOT NULL,
	"config_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculations_grade_allowed" CHECK ("geo_score_calculator"."calculations"."grade" in ('A','B','C','D','F'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geo_score_calculator"."config" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"weight_statistics" double precision NOT NULL,
	"weight_action_verbs" double precision NOT NULL,
	"weight_structure" double precision NOT NULL,
	"weight_objectivity" double precision NOT NULL,
	"benchmark_stats" double precision NOT NULL,
	"benchmark_verbs" double precision NOT NULL,
	"benchmark_structure" double precision NOT NULL,
	"benchmark_objectivity" double precision NOT NULL,
	"grade_a_min" integer NOT NULL,
	"grade_b_min" integer NOT NULL,
	"grade_c_min" integer NOT NULL,
	"grade_d_min" integer NOT NULL,
	"action_verbs" text[] NOT NULL,
	"subjective_words" text[] NOT NULL,
	"false_positives" text[] NOT NULL,
	"bullet_patterns" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calculations_user_email_created_at_idx" ON "geo_score_calculator"."calculations" USING btree ("user_email","created_at");