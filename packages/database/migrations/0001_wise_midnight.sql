ALTER TABLE "mcp_server_connect" ADD COLUMN "connection_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD COLUMN "mcp_server_user_id" text;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD CONSTRAINT "mcp_server_connect_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "mcp_server_connect" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "mcp_server_connect" DROP COLUMN "mcp_server_distinct_id";