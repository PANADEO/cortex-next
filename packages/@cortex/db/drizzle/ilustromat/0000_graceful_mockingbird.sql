CREATE SCHEMA "ilustromat";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ilustromat"."frame_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color_bg" text NOT NULL,
	"color_text" text NOT NULL,
	"color_accent" text NOT NULL,
	"font_source" text DEFAULT 'library' NOT NULL,
	"font_library_id" text,
	"logo_position" text DEFAULT 'bottom-right' NOT NULL,
	"corner_radius" integer DEFAULT 28 NOT NULL,
	"min_image_area_ratio" double precision DEFAULT 0.45 NOT NULL,
	"website_text" text,
	"layout" text DEFAULT 'image-top' NOT NULL,
	"text_align" text DEFAULT 'left' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frame_templates_font_source_allowed" CHECK ("ilustromat"."frame_templates"."font_source" in ('library', 'custom')),
	CONSTRAINT "frame_templates_logo_position_allowed" CHECK ("ilustromat"."frame_templates"."logo_position" in ('bottom-left', 'bottom-right')),
	CONSTRAINT "frame_templates_layout_allowed" CHECK ("ilustromat"."frame_templates"."layout" in ('image-top', 'image-bottom')),
	CONSTRAINT "frame_templates_text_align_allowed" CHECK ("ilustromat"."frame_templates"."text_align" in ('left', 'center')),
	CONSTRAINT "frame_templates_corner_radius_range" CHECK ("ilustromat"."frame_templates"."corner_radius" between 0 and 48),
	CONSTRAINT "frame_templates_min_image_area_ratio_range" CHECK ("ilustromat"."frame_templates"."min_image_area_ratio" between 0.35 and 0.60),
	CONSTRAINT "frame_templates_colors_hex" CHECK ("ilustromat"."frame_templates"."color_bg" ~ '^#[0-9A-Fa-f]{6}$'
          and "ilustromat"."frame_templates"."color_text" ~ '^#[0-9A-Fa-f]{6}$'
          and "ilustromat"."frame_templates"."color_accent" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "frame_templates_font_source_shape" CHECK (("ilustromat"."frame_templates"."font_source" = 'library' and "ilustromat"."frame_templates"."font_library_id" is not null)
          or ("ilustromat"."frame_templates"."font_source" = 'custom' and "ilustromat"."frame_templates"."font_library_id" is null))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ilustromat"."template_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"sha256" text NOT NULL,
	"font_family" text,
	"original_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_assets_template_kind_unique" UNIQUE("template_id","kind"),
	CONSTRAINT "template_assets_kind_allowed" CHECK ("ilustromat"."template_assets"."kind" in ('font-regular', 'font-bold', 'logo'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ilustromat"."template_assets" ADD CONSTRAINT "template_assets_template_id_frame_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "ilustromat"."frame_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
