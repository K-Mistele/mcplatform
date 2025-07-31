CREATE TYPE "public"."ingestion_job_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "retrieval_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"original_content" text NOT NULL,
	"order_in_document" integer NOT NULL,
	"contextualized_content" text NOT NULL,
	"metadata" jsonb,
	"created_at" bigint,
	"updated_at" bigint,
	CONSTRAINT "retrieval_chunks_unique_document_order" UNIQUE("document_id","order_in_document")
);
--> statement-breakpoint
CREATE TABLE "retrieval_documents" (
	"file_path" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"metadata" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" bigint,
	"updated_at" bigint,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_images" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text,
	"namespace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"contextual_content" text NOT NULL,
	"metadata" jsonb,
	"created_at" bigint,
	"updated_at" bigint,
	CONSTRAINT "retrieval_images_unique_url" UNIQUE("url","namespace_id")
);
--> statement-breakpoint
CREATE TABLE "retrieval_ingestion_job" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"namespace_id" text NOT NULL,
	"status" "ingestion_job_status" DEFAULT 'pending',
	"created_at" bigint,
	"updated_at" bigint,
	"total_documents" integer DEFAULT 0 NOT NULL,
	"documents_processed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_namespace" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" bigint,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "walkthroughs" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_document_id_retrieval_documents_file_path_fk" FOREIGN KEY ("document_id") REFERENCES "public"."retrieval_documents"("file_path") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_documents" ADD CONSTRAINT "retrieval_documents_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_documents" ADD CONSTRAINT "retrieval_documents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_images" ADD CONSTRAINT "retrieval_images_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_images" ADD CONSTRAINT "retrieval_images_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_ingestion_job" ADD CONSTRAINT "retrieval_ingestion_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_ingestion_job" ADD CONSTRAINT "retrieval_ingestion_job_namespace_id_retrieval_namespace_id_fk" FOREIGN KEY ("namespace_id") REFERENCES "public"."retrieval_namespace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_namespace" ADD CONSTRAINT "retrieval_namespace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retrieval_chunks_document_id_idx" ON "retrieval_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "retrieval_chunks_namespace_id_idx" ON "retrieval_chunks" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "retrieval_documents_namespace_id_idx" ON "retrieval_documents" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "retrieval_images_namespace_id_idx" ON "retrieval_images" USING btree ("namespace_id");--> statement-breakpoint
CREATE INDEX "retrieval_namespace_name_idx" ON "retrieval_namespace" USING btree ("name");--> statement-breakpoint
ALTER TABLE "mcp_server_walkthroughs" ADD CONSTRAINT "mcp_server_walkthroughs_server_walkthrough_unique" UNIQUE("mcp_server_id","walkthrough_id");