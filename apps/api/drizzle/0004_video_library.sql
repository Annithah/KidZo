CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid,
	"role" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"source" text NOT NULL,
	"source_url" text,
	"original_id" text,
	"author" text,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "age_groups" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "video_seconds" integer;--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_content_idx" ON "media_assets" USING btree ("content_id");--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_source_key_unique" UNIQUE("source_key");--> statement-breakpoint
-- Existing content: age groups from the age range (little 2-5, young 6-8, big 9-12).
UPDATE "content" SET "age_groups" = COALESCE((
	SELECT jsonb_agg(g.name ORDER BY g.min_age)
	FROM (VALUES ('little', 2, 5), ('young', 6, 8), ('big', 9, 12)) AS g(name, min_age, max_age)
	WHERE "content"."age_min" <= g.max_age AND "content"."age_max" >= g.min_age
), '[]'::jsonb) WHERE "age_groups" = '[]'::jsonb;
