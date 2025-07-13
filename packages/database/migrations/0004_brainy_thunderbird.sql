ALTER TYPE "public"."support_request_method" ADD VALUE 'none';--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "product_platform_or_tool" text;