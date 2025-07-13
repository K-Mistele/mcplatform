CREATE TABLE "mcp_tool_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" bigint,
	"mcp_server_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb,
	"output" jsonb
);
--> statement-breakpoint
ALTER TABLE "mcp_servers" ALTER COLUMN "product_platform_or_tool" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE no action ON UPDATE no action;