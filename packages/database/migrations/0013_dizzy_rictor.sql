ALTER TABLE "mcp_servers" DROP CONSTRAINT "mcp_servers_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "support_requests" DROP CONSTRAINT "support_requests_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "support_requests" DROP CONSTRAINT "support_requests_mcp_server_id_mcp_servers_id_fk";
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;