---
date: 2025-09-12T10:13:22-05:00
researcher: Kyle Mistele
git_commit: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
branch: 08-custom-oauth
repository: mcplatform
topic: "OAuth Scope Configuration Implementation Strategy"
tags: [implementation, strategy, oauth, scopes, custom-oauth]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: OAuth Scope Configuration for Custom OAuth Providers

## Task(s)
1. **Research OAuth scope requirements** - **Completed**
   - Analyzed current OAuth implementation to understand scope handling
   - Identified hardcoded default scope `'openid profile email'`
   - Documented database schema patterns and UI component structure
   
2. **Create research documentation** - **Completed**
   - Generated comprehensive research document with findings and recommendations
   - Identified specific files and line numbers requiring changes

3. **Implementation of scope configuration** - **Planned/Discussed**
   - Database schema update needed
   - UI component updates required
   - Server action modifications necessary
   - Authorization flow updates pending

## Recent changes
- Created research document: `specifications/08-custom-oauth/research/research_2025-09-12_10-08-22_oauth-scope-configuration.md`
- No code changes were made during this research phase

## Learnings

### Key Discovery: Hardcoded Default Scope
The system currently uses a hardcoded default scope at `packages/dashboard/src/app/oauth/authorize/route.ts:185`:
```typescript
scope: scope || 'openid profile email'
```
This prevents provider-specific scope configuration.

### Database Schema Pattern
The codebase uses two patterns for storing scopes:
- **Text fields** for OAuth protocol scopes: `text('scope')` or `text('scopes')`
- **JSON arrays** for structured data: `jsonb('field').$type<string[]>()`
Recommendation: Use text field for maximum provider flexibility.

### UI Progressive Disclosure Pattern
OAuth configuration uses progressive disclosure at `packages/dashboard/src/components/add-oauth-config-dialog.tsx:201-248`:
- Initial form shows only name and metadata URL
- Additional fields appear after validation
- Scope field should be added alongside credential fields after validation

### Provider Compatibility Requirements
Different OAuth providers handle scopes differently:
- Standard OAuth 2.0: Space-delimited
- GitHub: Space or comma-delimited
- Some providers: Custom delimiters
Storing as raw text string allows maximum flexibility.

## Artifacts
- `specifications/08-custom-oauth/implementation-plan.md` - Overall implementation strategy (Phase 3 UI work in progress)
- `specifications/08-custom-oauth/research/research_2025-09-12_10-08-22_oauth-scope-configuration.md` - Comprehensive research on scope configuration
- `specifications/08-custom-oauth/oauth-proxy-sequence-diagram.md` - OAuth flow documentation
- `specifications/08-custom-oauth/oauth-proxy-sequence-diagram.png` - Visual flow diagram

## Action Items & Next Steps

### 1. Update Database Schema
- Add `scopes` field to `customOAuthConfigs` table at `packages/database/src/schema.ts:123`
- Use pattern: `scopes: text('scopes').default('openid profile email')`
- Generate and run migration after schema update

### 2. Update UI Components
- Modify `packages/dashboard/src/components/add-oauth-config-dialog.tsx`:
  - Add `scopes` to form state (around line 36)
  - Add input field after client secret field (around line 246)
  - Include helper text explaining format
- Update `packages/dashboard/src/components/edit-oauth-config-dialog.tsx` similarly

### 3. Update Server Actions
- Modify `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`:
  - Add `scopes` to `createOAuthConfigSchema` (line 24)
  - Add `scopes` to `updateOAuthConfigSchema` (line 32)
  - Include scopes in database operations (lines 144-156)

### 4. Update Authorization Flow
- Modify `packages/dashboard/src/app/oauth/authorize/route.ts`:
  - Replace hardcoded default at line 185
  - Fetch OAuth config scopes and use as fallback
  - Update to: `scope: scope || oauthConfig.scopes || 'openid profile email'`

### 5. Update OAuth Config Interfaces
- Add `scopes` field to TypeScript interfaces in:
  - `packages/dashboard/src/components/oauth-configs-client.tsx` (lines 12-20)
  - Any other OAuth config type definitions

## Other Notes

### Important Files for OAuth Implementation
- **Database Schema**: `packages/database/src/schema.ts:109-130` - customOAuthConfigs table
- **Authorization Flow**: `packages/dashboard/src/app/oauth/authorize/route.ts` - OAuth proxy authorization
- **UI Components**: `packages/dashboard/src/components/add-oauth-config-dialog.tsx` - Configuration dialog
- **Server Actions**: `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts` - CRUD operations

### Testing Considerations
- Test with different OAuth providers (GitHub, Google, Auth0)
- Verify scope formatting works with various delimiters
- Ensure backward compatibility with existing configurations

### Security Note
The implementation plan notes that client secrets are stored in plaintext with a TODO for encryption (`packages/database/src/schema.ts:122`). This should be considered for future security enhancements.

### Design Decision Context
The original implementation explicitly excluded custom scope mapping to focus on core functionality. This enhancement adds configuration flexibility while maintaining the simplified proxy architecture.