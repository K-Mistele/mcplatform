---
date: 2025-08-04T00:00:00-00:00
researcher: Kyle
git_commit: dee9229505e7a7358d4b2b4f3280e328f497c50e
branch: master
repository: mcplatform
topic: "Job Monitoring Sub-Feature"
tags: [sub-feature, job-monitoring, documentation-retrieval, real-time-updates]
status: planned
last_updated: 2025-08-04
last_updated_by: Kyle
type: sub-feature
---

# Job Monitoring Sub-Feature

## Overview
This sub-feature provides real-time monitoring of document ingestion jobs, showing progress, status, and detailed job information through polling-based updates.

## Sub-Feature Scope
- Ingestion jobs listing with real-time status updates
- Job detail view with document processing timeline
- Progress tracking and completion statistics
- Failure handling and error display (requires new database schema)

## Key Components
- **Jobs List**: Table showing job ID, namespace, status, progress, start time
- **Job Detail View**: Timeline of document processing with success/failure states
- **Real-time Updates**: Polling-based refresh using oRPC calls and intervals
- **Failure Tracking**: New database table and UI for processing failures

## Parent Feature Relationship
This is part of the larger Documentation Retrieval UI feature and provides:
- Status data for namespace management displays
- Detailed progress information for document ingestion
- Integration with GitHub Action triggered ingestions

## Related Sub-Features
- **Namespace Management**: Consumes job status for namespace status display
- **Document Views**: Shows which documents were processed in each job
- **Search Testing**: Jobs populate the documents available for search

## Technical Notes
- Use polling with oRPC calls (NO server-sent events)
- Status calculation: derived from processed/total documents (currently hardcoded)
- Consider generated column in schema.ts using Drizzle for status calculation
- New database table required for ingestion failures

## Implementation Priority
**High Priority** - Critical for providing feedback on ingestion operations.