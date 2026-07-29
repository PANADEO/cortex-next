CREATE SCHEMA "system_config";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."application_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_scopes_application_code_unique" UNIQUE("application_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"category" text,
	"kind" text DEFAULT 'native' NOT NULL,
	"route" text,
	"url" text,
	"target" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_code_unique" UNIQUE("code"),
	CONSTRAINT "applications_kind_allowed" CHECK ("system_config"."applications"."kind" in ('native', 'external-link', 'iframe')),
	CONSTRAINT "applications_kind_shape" CHECK (("system_config"."applications"."kind" = 'native' and "system_config"."applications"."route" is not null and "system_config"."applications"."url" is null)
          or ("system_config"."applications"."kind" <> 'native' and "system_config"."applications"."url" is not null and "system_config"."applications"."route" is null))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."permissions_matrix" (
	"role_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_matrix_role_id_application_id_pk" PRIMARY KEY("role_id","application_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."role_application_scopes" (
	"role_id" uuid NOT NULL,
	"application_scope_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_application_scopes_role_id_application_scope_id_pk" PRIMARY KEY("role_id","application_scope_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."application_scopes" ADD CONSTRAINT "application_scopes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "system_config"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."permissions_matrix" ADD CONSTRAINT "permissions_matrix_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "system_config"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."permissions_matrix" ADD CONSTRAINT "permissions_matrix_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "system_config"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."role_application_scopes" ADD CONSTRAINT "role_application_scopes_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "system_config"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."role_application_scopes" ADD CONSTRAINT "role_application_scopes_application_scope_id_application_scopes_id_fk" FOREIGN KEY ("application_scope_id") REFERENCES "system_config"."application_scopes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system_config"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_config"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "system_config"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
