CREATE TYPE "public"."walkthrough_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "mcp_server_walkthroughs" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_id" text NOT NULL,
	"walkthrough_id" text NOT NULL,
	"created_at" bigint
);
--> statement-breakpoint
CREATE TABLE "walkthrough_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"walkthrough_id" text NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"current_step_id" text,
	"completed_at" bigint,
	"started_at" bigint,
	"last_activity_at" bigint,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "walkthrough_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"walkthrough_id" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"display_order" text NOT NULL,
	"next_step_id" text,
	"created_at" bigint,
	"updated_at" bigint,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "walkthroughs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "walkthrough_status" DEFAULT 'draft',
	"created_at" bigint,
	"updated_at" bigint,
	"estimated_duration_minutes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "walkthrough_tools_enabled" text DEFAULT 'true';--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD CONSTRAINT "mcp_server_walkthroughs_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD CONSTRAINT "mcp_server_walkthroughs_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_current_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_steps" ADD CONSTRAINT "walkthrough_steps_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_steps" ADD CONSTRAINT "walkthrough_steps_next_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("next_step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthroughs" ADD CONSTRAINT "walkthroughs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_server_id_idx" ON "mcp_server_walkthroughs" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_walkthrough_id_idx" ON "mcp_server_walkthroughs" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_user_id_idx" ON "walkthrough_progress" USING btree ("mcp_server_user_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_walkthrough_id_idx" ON "walkthrough_progress" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_last_activity_idx" ON "walkthrough_progress" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_completed_steps_gin_idx" ON "walkthrough_progress" USING gin ("completed_steps");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_walkthrough_id_idx" ON "walkthrough_steps" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_display_order_idx" ON "walkthrough_steps" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_next_step_id_idx" ON "walkthrough_steps" USING btree ("next_step_id");--> statement-breakpoint
CREATE INDEX "walkthroughs_organization_id_idx" ON "walkthroughs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "walkthroughs_status_idx" ON "walkthroughs" USING btree ("status");