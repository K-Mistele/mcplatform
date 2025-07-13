ALTER TABLE "mcp_server_connect" DROP CONSTRAINT "mcp_server_connect_mcp_server_user_id_mcp_server_user_id_fk";
--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD COLUMN "mcp_server_distinct_id" text;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" DROP COLUMN "mcp_server_user_id";