ALTER TABLE "retrieval_chunks" RENAME COLUMN "document_id" TO "document_path";--> statement-breakpoint
ALTER TABLE "retrieval_chunks" DROP CONSTRAINT "retrieval_chunks_unique_document_order";--> statement-breakpoint
ALTER TABLE "retrieval_chunks" DROP CONSTRAINT "retrieval_chunks_document_id_retrieval_documents_file_path_fk";
--> statement-breakpoint
DROP INDEX "retrieval_chunks_document_id_idx";--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_document_path_retrieval_documents_file_path_fk" FOREIGN KEY ("document_path") REFERENCES "public"."retrieval_documents"("file_path") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retrieval_chunks_document_id_idx" ON "retrieval_chunks" USING btree ("document_path");--> statement-breakpoint
ALTER TABLE "retrieval_chunks" ADD CONSTRAINT "retrieval_chunks_unique_document_order" UNIQUE("document_path","order_in_document","namespace_id");