CREATE TABLE "walkthrough_step_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"mcp_server_user_id" text NOT NULL,
	"walkthrough_id" text NOT NULL,
	"step_id" text NOT NULL,
	"mcp_server_id" text NOT NULL,
	"mcp_server_session_id" text NOT NULL,
	"completed_at" bigint,
	"metadata" jsonb,
	CONSTRAINT "wtsc_user_step_unique" UNIQUE("mcp_server_user_id","walkthrough_id","step_id")
);
--> statement-breakpoint
ALTER TABLE "walkthrough_step_completions" ADD CONSTRAINT "walkthrough_step_completions_mcp_server_user_id_mcp_server_user_id_fk" FOREIGN KEY ("mcp_server_user_id") REFERENCES "public"."mcp_server_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_step_completions" ADD CONSTRAINT "walkthrough_step_completions_walkthrough_id_walkthroughs_id_fk" FOREIGN KEY ("walkthrough_id") REFERENCES "public"."walkthroughs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_step_completions" ADD CONSTRAINT "walkthrough_step_completions_step_id_walkthrough_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."walkthrough_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_step_completions" ADD CONSTRAINT "walkthrough_step_completions_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkthrough_step_completions" ADD CONSTRAINT "walkthrough_step_completions_mcp_server_session_id_mcp_server_session_mcp_server_session_id_fk" FOREIGN KEY ("mcp_server_session_id") REFERENCES "public"."mcp_server_session"("mcp_server_session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wtsc_server_time_idx" ON "walkthrough_step_completions" USING btree ("mcp_server_id","completed_at");--> statement-breakpoint
CREATE INDEX "wtsc_walkthrough_step_time_idx" ON "walkthrough_step_completions" USING btree ("walkthrough_id","step_id","completed_at");--> statement-breakpoint
CREATE INDEX "wtsc_user_walkthrough_idx" ON "walkthrough_step_completions" USING btree ("mcp_server_user_id","walkthrough_id");--> statement-breakpoint
CREATE INDEX "wtsc_session_idx" ON "walkthrough_step_completions" USING btree ("mcp_server_session_id");--> statement-breakpoint
CREATE INDEX "wtsc_server_walkthrough_idx" ON "walkthrough_step_completions" USING btree ("mcp_server_id","walkthrough_id");