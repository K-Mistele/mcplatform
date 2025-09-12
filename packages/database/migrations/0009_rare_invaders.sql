ALTER TABLE "mcp_server_user" ADD COLUMN "upstream_sub" text;--> statement-breakpoint
ALTER TABLE "mcp_server_user" ADD COLUMN "profile_data" jsonb;--> statement-breakpoint
CREATE INDEX "mcp_server_user_upstream_sub_idx" ON "mcp_server_user" USING btree ("upstream_sub");