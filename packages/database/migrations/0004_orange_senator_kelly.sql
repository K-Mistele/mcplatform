CREATE TABLE "custom_oauth_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"authorization_url" text NOT NULL,
	"metadata_url" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"created_at" bigint,
	CONSTRAINT "custom_oauth_configs_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "mcp_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_client_registration_id" text NOT NULL,
	"upstream_token_id" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"used" text DEFAULT 'false' NOT NULL,
	"created_at" bigint,
	CONSTRAINT "mcp_authorization_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "mcp_client_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"client_metadata" jsonb,
	"created_at" bigint,
	CONSTRAINT "mcp_client_registrations_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_proxy_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_client_registration_id" text NOT NULL,
	"upstream_token_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" bigint,
	"created_at" bigint,
	CONSTRAINT "mcp_proxy_tokens_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "mcp_proxy_tokens_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "upstream_oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"oauth_config_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" bigint,
	"created_at" bigint
);
--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "custom_oauth_config_id" text;--> statement-breakpoint
ALTER TABLE "custom_oauth_configs" ADD CONSTRAINT "custom_oauth_configs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_mcp_client_registration_id_mcp_client_registrations_id_fk" FOREIGN KEY ("mcp_client_registration_id") REFERENCES "public"."mcp_client_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_upstream_token_id_upstream_oauth_tokens_id_fk" FOREIGN KEY ("upstream_token_id") REFERENCES "public"."upstream_oauth_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_client_registrations" ADD CONSTRAINT "mcp_client_registrations_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_proxy_tokens" ADD CONSTRAINT "mcp_proxy_tokens_mcp_client_registration_id_mcp_client_registrations_id_fk" FOREIGN KEY ("mcp_client_registration_id") REFERENCES "public"."mcp_client_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_proxy_tokens" ADD CONSTRAINT "mcp_proxy_tokens_upstream_token_id_upstream_oauth_tokens_id_fk" FOREIGN KEY ("upstream_token_id") REFERENCES "public"."upstream_oauth_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upstream_oauth_tokens" ADD CONSTRAINT "upstream_oauth_tokens_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upstream_oauth_tokens" ADD CONSTRAINT "upstream_oauth_tokens_oauth_config_id_custom_oauth_configs_id_fk" FOREIGN KEY ("oauth_config_id") REFERENCES "public"."custom_oauth_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_oauth_configs_organization_id_idx" ON "custom_oauth_configs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mcp_authorization_codes_code_idx" ON "mcp_authorization_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "mcp_authorization_codes_expires_at_idx" ON "mcp_authorization_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mcp_client_registrations_mcp_server_id_idx" ON "mcp_client_registrations" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "mcp_client_registrations_client_id_idx" ON "mcp_client_registrations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "mcp_proxy_tokens_access_token_idx" ON "mcp_proxy_tokens" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "mcp_proxy_tokens_refresh_token_idx" ON "mcp_proxy_tokens" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX "mcp_proxy_tokens_expires_at_idx" ON "mcp_proxy_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upstream_oauth_tokens_mcp_server_user_id_idx" ON "upstream_oauth_tokens" USING btree ("mcp_server_user_id");--> statement-breakpoint
CREATE INDEX "upstream_oauth_tokens_oauth_config_id_idx" ON "upstream_oauth_tokens" USING btree ("oauth_config_id");--> statement-breakpoint
CREATE INDEX "upstream_oauth_tokens_expires_at_idx" ON "upstream_oauth_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_custom_oauth_config_id_custom_oauth_configs_id_fk" FOREIGN KEY ("custom_oauth_config_id") REFERENCES "public"."custom_oauth_configs"("id") ON DELETE set null ON UPDATE no action;