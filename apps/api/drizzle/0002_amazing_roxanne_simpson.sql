CREATE TABLE "guest_content_daily_stats" (
	"content_id" uuid NOT NULL,
	"date" text NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"seconds_played" integer DEFAULT 0 NOT NULL,
	"completed_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "guest_content_daily_stats_content_id_date_pk" PRIMARY KEY("content_id","date")
);
--> statement-breakpoint
ALTER TABLE "guest_content_daily_stats" ADD CONSTRAINT "guest_content_daily_stats_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_content_daily_date_idx" ON "guest_content_daily_stats" USING btree ("date");