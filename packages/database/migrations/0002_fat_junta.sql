CREATE TYPE "public"."mcp_server_auth_type" AS ENUM('oauth', 'none', 'collect_email');--> statement-breakpoint
CREATE TYPE "public"."support_request_method" AS ENUM('slack', 'linear', 'dashboard');--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "auth_type" "mcp_server_auth_type" DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "information_message" text;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "support_ticket_type" "support_request_method" DEFAULT 'dashboard';