CREATE INDEX "mcp_server_session_user_id_idx" ON "mcp_server_session" USING btree ("mcp_server_user_id");--> statement-breakpoint
CREATE INDEX "mcp_server_session_mcp_server_slug_idx" ON "mcp_server_session" USING btree ("mcp_server_slug");--> statement-breakpoint
CREATE INDEX "mcp_server_user_distinct_id_idx" ON "mcp_server_user" USING btree ("distinct_id");--> statement-breakpoint
CREATE INDEX "mcp_server_user_email_idx" ON "mcp_server_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mcp_server_slug_idx" ON "mcp_servers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tool_calls_mcp_server_session_id_idx" ON "mcp_tool_calls" USING btree ("mcp_server_session_id");