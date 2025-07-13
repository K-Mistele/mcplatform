ALTER TYPE "public"."support_request_status" ADD VALUE 'needs_email' BEFORE 'pending';--> statement-breakpoint
ALTER TABLE "support_requests" RENAME COLUMN "use_case" TO "context";--> statement-breakpoint
ALTER TABLE "support_requests" RENAME COLUMN "problem_description" TO "support_request_method";--> statement-breakpoint
ALTER TABLE "mcp_servers" ALTER COLUMN "auth_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ALTER COLUMN "auth_type" SET DEFAULT 'none'::text;--> statement-breakpoint
DROP TYPE "public"."mcp_server_auth_type";--> statement-breakpoint
CREATE TYPE "public"."mcp_server_auth_type" AS ENUM('platform_oauth', 'custom_oauth', 'none', 'collect_email');--> statement-breakpoint
ALTER TABLE "mcp_servers" ALTER COLUMN "auth_type" SET DEFAULT 'none'::"public"."mcp_server_auth_type";--> statement-breakpoint
ALTER TABLE "mcp_servers" ALTER COLUMN "auth_type" SET DATA TYPE "public"."mcp_server_auth_type" USING "auth_type"::"public"."mcp_server_auth_type";--> statement-breakpoint
ALTER TABLE "support_requests" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "resolved_at" bigint;--> statement-breakpoint
ALTER TABLE "mcp_servers" DROP COLUMN "information_message";