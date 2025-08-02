CREATE TYPE "public"."ingestion_job_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mcp_server_auth_type" AS ENUM('platform_oauth', 'custom_oauth', 'none', 'collect_email');--> statement-breakpoint
CREATE TYPE "public"."support_request_method" AS ENUM('slack', 'linear', 'dashboard', 'none');--> statement-breakpoint
CREATE TYPE "public"."support_request_status" AS ENUM('needs_email', 'pending', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_activity_type" AS ENUM('comment', 'status_change', 'assignment', 'field_update', 'system');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."walkthrough_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."walkthrough_type" AS ENUM('course', 'installer', 'troubleshooting', 'integration', 'quickstart');--> statement-breakpoint
CREATE TABLE "retrieval_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_path" text NOT NULL,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"original_content" text NOT NULL,
	"order_in_document" integer NOT NULL,
	"contextualized_content" text NOT NULL,
	"metadata" jsonb,
	"created_at" bigint,
	"updated_at" bigint,
	CONSTRAINT "retrieval_chunks_unique_document_order" UNIQUE("document_path","order_in_document","namespace_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "retrieval_documents" (
	"title" text,
	"file_path" text NOT NULL,
	"content_type" text,
	"metadata" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" bigint,
	"updated_at" bigint,
	"content_hash" text NOT NULL,
	CONSTRAINT "retrieval_documents_unique_file_path" PRIMARY KEY("file_path","organization_id","namespace_id"),
	CONSTRAINT "retrieval_documents_namespace_organization_unique" UNIQUE("namespace_id","organization_id","file_path")
);
--> statement-breakpoint
CREATE TABLE "retrieval_images" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"contextual_content" text NOT NULL,
	"metadata" jsonb,
	"created_at" bigint,
	"updated_at" bigint,
	CONSTRAINT "retrieval_images_unique_url" UNIQUE("url","namespace_id")
);
--> statement-breakpoint
CREATE TABLE "retrieval_ingestion_job" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"namespace_id" text NOT NULL,
	"status" "ingestion_job_status" DEFAULT 'pending',
	"created_at" bigint,
	"updated_at" bigint,
	"total_documents" integer DEFAULT 0 NOT NULL,
	"documents_processed" integer DEFAULT 0 NOT NULL,
	"documents_failed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_server_session" (
	"title" text,
	"mcp_server_session_id" text PRIMARY KEY NOT NULL,
	"mcp_server_slug" text NOT NULL,
	"connection_date" date NOT NULL,
	"connection_timestamp" bigint,
	"mcp_server_user_id" text
);
--> statement-breakpoint
CREATE TABLE "mcp_server_user" (
	"id" text PRIMARY KEY NOT NULL,
	"distinct_id" text,
	"email" text,
	"first_seen_at" bigint,
	CONSTRAINT "mcp_server_user_distinct_id_unique" UNIQUE NULLS NOT DISTINCT("distinct_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_server_walkthroughs" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_id" text NOT NULL,
	"walkthrough_id" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" text DEFAULT 'true' NOT NULL,
	"created_at" bigint,
	CONSTRAINT "mcp_server_walkthroughs_server_walkthrough_unique" UNIQUE("mcp_server_id","walkthrough_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"oauth_issuer_url" text,
	"name" text NOT NULL,
	"product_platform_or_tool" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" bigint,
	"auth_type" "mcp_server_auth_type" DEFAULT 'none',
	"support_ticket_type" "support_request_method" DEFAULT 'dashboard',
	"walkthrough_tools_enabled" text DEFAULT 'true',
	CONSTRAINT "mcp_servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "retrieval_namespace" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" bigint,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" bigint,
	"title" text,
	"concise_summary" text,
	"context" text,
	"status" "support_request_status" DEFAULT 'pending',
	"support_request_method" "support_request_method" DEFAULT 'dashboard',
	"resolved_at" bigint,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"mcp_server_id" text,
	"mcp_server_session_id" text,
	"assignee_id" text,
	"priority" "support_ticket_priority" DEFAULT 'medium'
);
--> statement-breakpoint
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
CREATE TABLE "mcp_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" bigint,
	"mcp_server_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"mcp_server_user_id" text,
	"mcp_server_session_id" text NOT NULL,
	"input" jsonb,
	"output" jsonb
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
	"content_fields" jsonb DEFAULT '{"version":"v1","introductionForAgent":"","contextForAgent":"","contentForUser":"","operationsForAgent":""}'::jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
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
	"type" "walkthrough_type" DEFAULT 'course' NOT NULL,
	"status" "walkthrough_status" DEFAULT 'draft',
	"created_at" bigint,
	"updated_at" bigint,
	"estimated_duration_minutes" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "oauth_application" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon" text,
	"metadata" text,
	"client_id" text,
	"client_secret" text,
	"redirect_u_r_ls" text,
	"type" text,
	"disabled" boolean,
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"consent_given" boolean
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "mcp_oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "mcp_oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_application" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon" text,
	"metadata" text,
	"client_id" text,
	"client_secret" text,
	"redirect_u_r_ls" text,
	"type" text,
	"disabled" boolean,
	"user_id" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "mcp_oauth_application_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"user_id" text,
	"scopes" text,
	"created_at" timestamp,
	"updated_at" timestamp,
	"consent_given" boolean
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "mcp_oauth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "mcp_oauth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "mcp_oauth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_document_namespace_organization_fk" FOREIGN KEY ("document_path","namespace_id","organization_id") REFERENCES "public"."retrieval_documents"("file_path","namespace_id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_documents" ADD CONSTRAINT "retrieval_documents_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_documents" ADD CONSTRAINT "retrieval_documents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_images" ADD CONSTRAINT "retrieval_images_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_images" ADD CONSTRAINT "retrieval_images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_ingestion_job" ADD CONSTRAINT "retrieval_ingestion_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_ingestion_job" ADD CONSTRAINT "retrieval_ingestion_job_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_session" ADD CONSTRAINT "mcp_server_session_mcp_server_slug_mcp_servers_slug_fk" FOREIGN KEY ("mcp_server_slug") REFERENCES "public"."mcp_servers"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_session" ADD CONSTRAINT "mcp_server_session_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD CONSTRAINT "mcp_server_walkthroughs_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD CONSTRAINT "mcp_server_walkthroughs_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_namespace" ADD CONSTRAINT "retrieval_namespace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_mcp_server_session_id_mcp_server_session_mcp_server_session_id_fk" FOREIGN KEY ("mcp_server_session_id") REFERENCES "public"."mcp_server_session"("mcp_server_session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_support_request_id_support_requests_id_fk" FOREIGN KEY ("support_request_id") REFERENCES "public"."support_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_session_id_mcp_server_session_mcp_server_session_id_fk" FOREIGN KEY ("mcp_server_session_id") REFERENCES "public"."mcp_server_session"("mcp_server_session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_progress" ADD CONSTRAINT "walkthrough_progress_current_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("current_step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_steps" ADD CONSTRAINT "walkthrough_steps_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_steps" ADD CONSTRAINT "walkthrough_steps_next_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("next_step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthroughs" ADD CONSTRAINT "walkthroughs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_account" ADD CONSTRAINT "mcp_oauth_account_user_id_mcp_oauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_oauth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_oauth_session" ADD CONSTRAINT "mcp_oauth_session_user_id_mcp_oauth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mcp_oauth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retrieval_chunks_document_path_order_idx" ON "retrieval_chunks" USING btree ("document_path","namespace_id","organization_id");--> statement-breakpoint
CREATE INDEX "retrieval_chunks_namespace_id_idx" ON "retrieval_chunks" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "retrieval_documents_namespace_id_idx" ON "retrieval_documents" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "retrieval_images_namespace_id_idx" ON "retrieval_images" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "mcp_server_session_user_id_idx" ON "mcp_server_session" USING btree ("mcp_server_user_id");--> statement-breakpoint
CREATE INDEX "mcp_server_session_mcp_server_slug_idx" ON "mcp_server_session" USING btree ("mcp_server_slug");--> statement-breakpoint
CREATE INDEX "mcp_server_user_distinct_id_idx" ON "mcp_server_user" USING btree ("distinct_id");--> statement-breakpoint
CREATE INDEX "mcp_server_user_email_idx" ON "mcp_server_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_server_id_idx" ON "mcp_server_walkthroughs" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_walkthrough_id_idx" ON "mcp_server_walkthroughs" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_display_order_idx" ON "mcp_server_walkthroughs" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "mcp_server_slug_idx" ON "mcp_servers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "retrieval_namespace_name_idx" ON "retrieval_namespace" USING btree ("name");--> statement-breakpoint
CREATE INDEX "support_ticket_activities_support_request_id_idx" ON "support_ticket_activities" USING btree ("support_request_id");--> statement-breakpoint
CREATE INDEX "support_ticket_activities_created_at_idx" ON "support_ticket_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tool_calls_mcp_server_session_id_idx" ON "mcp_tool_calls" USING btree ("mcp_server_session_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_user_id_idx" ON "walkthrough_progress" USING btree ("mcp_server_user_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_walkthrough_id_idx" ON "walkthrough_progress" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_last_activity_idx" ON "walkthrough_progress" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "walkthrough_progress_completed_steps_gin_idx" ON "walkthrough_progress" USING gin ("completed_steps");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_walkthrough_id_idx" ON "walkthrough_steps" USING btree ("walkthrough_id");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_display_order_idx" ON "walkthrough_steps" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "walkthrough_steps_next_step_id_idx" ON "walkthrough_steps" USING btree ("next_step_id");--> statement-breakpoint
CREATE INDEX "walkthroughs_organization_id_idx" ON "walkthroughs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "walkthroughs_status_idx" ON "walkthroughs" USING btree ("status");