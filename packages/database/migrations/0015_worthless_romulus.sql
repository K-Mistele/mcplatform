ALTER TABLE "retrieval_chunks" DROP CONSTRAINT "retrieval_chunks_unique_document_order";--> statement-breakpoint
ALTER TABLE "retrieval_ingestion_job" ADD COLUMN "documents_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_unique_document_order" UNIQUE("document_path","order_in_document","namespace_id","organization_id");