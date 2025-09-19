CREATE TABLE "mcp_authorization_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_client_registration_id" text NOT NULL,
	"custom_oauth_config_id" text NOT NULL,
	"state" text NOT NULL,
	"client_state" text,
	"redirect_uri" text NOT NULL,
	"scope" text NOT NULL,
	"created_at" bigint,
	"expires_at" bigint NOT NULL,
	CONSTRAINT "mcp_authorization_sessions_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "custom_oauth_configs" ADD COLUMN "token_url" text;--> statement-breakpoint
ALTER TABLE "mcp_authorization_sessions" ADD CONSTRAINT "mcp_authorization_sessions_mcp_client_registration_id_mcp_client_registrations_id_fk" FOREIGN KEY ("mcp_client_registration_id") REFERENCES "public"."mcp_client_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorization_sessions" ADD CONSTRAINT "mcp_authorization_sessions_custom_oauth_config_id_custom_oauth_configs_id_fk" FOREIGN KEY ("custom_oauth_config_id") REFERENCES "public"."custom_oauth_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_authorization_sessions_state_idx" ON "mcp_authorization_sessions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "mcp_authorization_sessions_expires_at_idx" ON "mcp_authorization_sessions" USING btree ("expires_at");