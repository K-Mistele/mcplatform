CREATE TYPE "public"."support_ticket_activity_type" AS ENUM('comment', 'status_change', 'assignment', 'field_update', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "support_ticket_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" bigint,
	"support_request_id" text NOT NULL,
	"user_id" text NOT NULL,
	"activity_type" "support_ticket_activity_type" NOT NULL,
	"content" jsonb,
	"content_type" text DEFAULT 'text',
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "priority" "support_ticket_priority" DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_support_request_id_support_requests_id_fk" FOREIGN KEY ("support_request_id") REFERENCES "public"."support_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_ticket_activities_support_request_id_idx" ON "support_ticket_activities" USING btree ("support_request_id");--> statement-breakpoint
CREATE INDEX "support_ticket_activities_created_at_idx" ON "support_ticket_activities" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;