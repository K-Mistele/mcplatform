CREATE TYPE "public"."walkthrough_type" AS ENUM('course', 'installer', 'troubleshooting', 'integration', 'quickstart');--> statement-breakpoint
ALTER TABLE "walkthrough_steps" ADD COLUMN "content_fields" jsonb DEFAULT '{"version":"v1","introductionForAgent":"","contextForAgent":"","contentForUser":"","operationsForAgent":""}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "walkthroughs" ADD COLUMN "type" "walkthrough_type" DEFAULT 'course';--> statement-breakpoint
ALTER TABLE "walkthrough_steps" DROP COLUMN "instructions";