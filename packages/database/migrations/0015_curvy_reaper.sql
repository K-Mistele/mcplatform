CREATE TABLE IF NOT EXISTS "mcp_server_connect" (
	"slug" text,
	"distinct_id" text,
	"email" text,
	"created_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_server_user" (
	"transport" text DEFAULT 'streamable_http' NOT NULL,
	"distinct_id" text,
	"email" text,
	"first_seen_at" bigint,
	CONSTRAINT "mcp_server_user_distinct_id_unique" UNIQUE NULLS NOT DISTINCT("distinct_id"),
	CONSTRAINT "mcp_server_user_email_unique" UNIQUE NULLS NOT DISTINCT("email")
);
--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD CONSTRAINT "mcp_server_connect_slug_mcp_servers_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."mcp_servers"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD CONSTRAINT "mcp_server_connect_distinct_id_mcp_server_user_distinct_id_fk" FOREIGN KEY ("distinct_id") REFERENCES "public"."mcp_server_user"("distinct_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_connect" ADD CONSTRAINT "mcp_server_connect_email_mcp_server_user_email_fk" FOREIGN KEY ("email") REFERENCES "public"."mcp_server_user"("email") ON DELETE cascade ON UPDATE no action;