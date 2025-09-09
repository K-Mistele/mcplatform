---
date: 2025-09-05T11:41:18-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "OAuth Server Discovery & Validation Implementation"
tags: [research-topic, oauth, rfc8414, validation, discovery]
status: pending
type: research-topic
---

# Research Topic: OAuth Server Discovery & Validation Implementation

## Objective
Implement real-time OAuth server URL validation with RFC 8414 compliance for custom OAuth configuration in the MCPlatform dashboard.

## Key Research Questions
1. How to implement RFC 8414 OAuth Authorization Server Metadata schema validation using Zod?
2. What is the correct debounced validation pattern (2-second delay) following existing codebase conventions?
3. How to handle OAuth server discovery endpoint failures and provide clear user feedback?
4. What caching strategy should be used for OAuth metadata to avoid repeated network calls?

## Implementation Context
- **Current State**: `add-server-modal.tsx:97-128` has established debounced validation pattern for server name validation
- **Required Fields**: OAuth server URL input with automatic `.well-known/oauth-authorization-server` path appending
- **UI Feedback**: Success/error/loading indicators following existing validation styling patterns
- **Integration Point**: Must work within existing server creation modal and edit configuration forms

## Expected Deliverables
- RFC 8414 Zod schema for OAuth Authorization Server Metadata validation
- Debounced validation hook implementation following codebase patterns
- Server action for OAuth server discovery and validation
- UI component updates for real-time validation feedback
- Error handling strategy for offline/invalid OAuth servers

## Dependencies
- Existing validation patterns in `add-server-modal.tsx`
- oRPC action structure in `packages/dashboard/src/lib/orpc/actions/`
- UI component patterns from `components/ui/` (shadcn/ui)

## Priority
**High** - Foundation requirement for all custom OAuth functionality