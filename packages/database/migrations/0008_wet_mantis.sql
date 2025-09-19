ALTER TABLE "mcp_authorization_codes" ADD COLUMN "authorization_session_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_authorization_sessions" ADD COLUMN "code_challenge" text;--> statement-breakpoint
ALTER TABLE "mcp_authorization_sessions" ADD COLUMN "code_challenge_method" text;--> statement-breakpoint
ALTER TABLE "mcp_authorization_codes" ADD CONSTRAINT "mcp_authorization_codes_authorization_session_id_mcp_authorization_sessions_id_fk" FOREIGN KEY ("authorization_session_id") REFERENCES "public"."mcp_authorization_sessions"("id") ON DELETE cascade ON UPDATE no action;