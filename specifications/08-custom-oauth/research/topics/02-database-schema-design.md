---
date: 2025-09-05T11:41:18-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "Database Schema Design for Custom OAuth"
tags: [research-topic, database, schema, migration, encryption]
status: pending
type: research-topic
---

# Research Topic: Database Schema Design for Custom OAuth

## Objective
Design and implement the database schema for custom OAuth configurations and upstream token storage, including migration strategy from existing `oauthIssuerUrl` field.

## Key Research Questions
1. What is the exact Drizzle ORM schema definition for `custom_oauth_configs` and `upstream_oauth_tokens` tables?
2. How to implement encryption at rest for client secrets following existing patterns in the codebase?
3. What indexing strategy is needed for performance (organization lookups, token validation, etc.)?
4. How to safely migrate existing `mcpServers.oauthIssuerUrl` usage without breaking existing functionality?
5. What foreign key relationships and constraints are needed for data integrity?

## Implementation Context
- **Current State**: `packages/database/src/schema.ts:117` has unused `oauthIssuerUrl` field in `mcpServers` table
- **Existing Pattern**: `packages/database/src/mcp-auth-schema.ts` shows OAuth application table structure for reference
- **Organization Scoping**: Must follow existing organization multi-tenancy patterns
- **Token Storage**: Needs secure storage for access tokens, refresh tokens, and expiration timestamps

## Expected Deliverables
- Complete Drizzle schema definitions for new tables
- Migration script to create new tables and add foreign key to `mcpServers`
- Encryption implementation for sensitive fields (client_secret, access_token, refresh_token)
- Indexing strategy for performance optimization
- Migration strategy for existing `oauthIssuerUrl` field usage

## Dependencies
- Existing schema patterns in `packages/database/src/`
- Organization multi-tenancy implementation
- Drizzle ORM migration system
- Encryption utilities (if existing) or implementation plan

## Priority
**High** - Required foundation for all custom OAuth data storage