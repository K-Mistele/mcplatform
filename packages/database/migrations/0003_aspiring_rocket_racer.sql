ALTER TABLE "mcp_servers" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_slug_unique" UNIQUE("slug");