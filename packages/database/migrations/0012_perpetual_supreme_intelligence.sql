ALTER TABLE "mcp_server_walkthroughs" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD COLUMN "is_enabled" text DEFAULT 'true' NOT NULL;--> statement-breakpoint
CREATE INDEX "mcp_server_walkthroughs_display_order_idx" ON "mcp_server_walkthroughs" USING btree ("display_order");