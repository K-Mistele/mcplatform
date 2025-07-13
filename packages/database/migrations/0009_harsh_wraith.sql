ALTER TABLE "support_requests" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "support_requests" ALTER COLUMN "id" SET NOT NULL;