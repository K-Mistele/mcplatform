# Create Requirements Document Command

You are tasked with creating detailed, actionable requirements documents through an interactive, iterative process. You should be thorough, user-focused, and work collaboratively to produce high-quality specifications that lead to successful implementations.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature description, context, or rough specification was provided as a parameter, skip the default message
   - Begin the analysis process immediately
   - If files are referenced, read them FULLY first

2. **If no parameters provided**, respond with:
```
I'll help you create a comprehensive requirements document. Let me start by understanding what we're building.

Please provide:
1. The feature/system you want to specify (high-level description)
2. Any business goals or user problems this addresses
3. Links to related research, existing implementations, or context
4. Any constraints or technical considerations

I'll analyze this information and work with you to create detailed requirements.

Tip: You can also invoke this command with context: `/create_requirements user session management improvements` or `/create_requirements based on ticket thoughts/tickets/feature_123.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Problem Understanding

1. **Read all referenced files immediately and FULLY**:
   - resarch documents related to the feature you're working on (e.g. for `02-ticket-management` you would look for research documents under `specifications/02-ticket-management`)
   - realted implementation plans
   - **important**:Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn focused research tasks** (only if needed for complex features):
   ```
   Task 1 - Research current implementation:
   Find how [the feature area] currently works in the codebase.
   1. Locate relevant files and components
   2. Identify data models and existing patterns
   3. Look for similar features to model after
   Return: Key files and patterns with file:line references
   ```

3. **Understand the core problem**:
   - What user problem are we solving?
   - What does success look like?
   - Any critical constraints or dependencies?

4. **Confirm understanding and get clarification**:
   ```
   I understand you want to [accurate summary].

   Key findings:
   - [Current state/existing patterns]
   - [Main constraints]

   Questions:
   - [Critical workflow question]
   - [Key technical decision needed]
   ```

### Step 1.5: Feature Sizing Clarification.
1. **Feature sizing**:
   Think hard about the size of the feature. If the process to implement it will be very lengthy and complicated, you should consider asking the user if they would like to break it down into multiple sub-features. If you decide to do so, ask the user: 

   ```
   This feature seems quite large! Would you like for me to break it down into sub-features, or to proceed with one unified document?
   ```
   
2. **Subfeature definition**: 
   **If the user asks you to proceed with a unified document, you will skip this section**.
   If the user asks you to break it into sub-features, you will do the following: 

   - provide a suggestion of how the feature may be broken down into sub-features, and ask for feedback
   - on acceptance or correction, revise your structure. Then, create a sub-feature directory under the directory for each feature. e.g. like in `specifications/02-ticket-management`: `specifications/feature-name/` and then `specifications/feature-name/first-sub-feature-name`, `specifications/feature-name/second-sub-feature-name`.
   - under each sub-feature directory, create a `feature.md` document which at a high-level details what the sub-feature is, and what it should contain, and how it relates to the parent feature and other sub-features; as well as contains any links to documents about the feature as a whole.
   - Then, under `specifications/feature-name` create a `feature-definition-checklist.md` that tracks which subfeatures have been defined; we will use this to iteratively define sub-features. 
   - At this point, ask the user:

   ```
   I have set up sub-feature directories and tracking documents. PLease clear the session and re-initialize the requirements definition workflow for the sub-feature.
   ```


### Step 2: Core User Stories

1. **Focus on primary user flows**:
   - Main user workflow
   - Critical edge cases
   - Error scenarios that break functionality

2. **Write stories in given/when/then format**:
   ```
   Key user stories:

   1. **Given** [context], **when** [action], **then** [expected result]
   2. **Given** [edge case], **when** [action], **then** [handle gracefully]

   Do these cover the core functionality?
   ```

### Step 3: Essential Requirements

1. **Define what must work**:
   - Core functionality
   - Critical integrations
   - Authentication/authorization
   - Database operations

2. **Note constraints**:
   - Existing patterns to follow
   - Security requirements
   - Organization scoping

### Step 4: Write Requirements Document

Write the document directly using the standard template structure. Keep it focused on shipping functionality.

Use this lean template:

```markdown
# Requirements for [Feature Name]

## Goal
[Clear, concise statement of what we're building and the business problem it solves]

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
[Description of what currently exists, with file paths and references]

### Composition Pattern
[Standard pattern for data fetching and component structure - typically the async server component pattern with promises passed to client components; oRPC server actions for mutations; non-server-action oRPC calls for client-side data fetches.]

### Data Model
[Reference to relevant schema files or data models]

## User Stories
(in given/when/then format)

### [Category 1]
1. **[User Role]**: [User story description] - [Acceptance criteria and context]

2. **[User Role]**: [Another user story] - [Acceptance criteria and edge cases]

### [Category 2]
[More user stories organized by functional area]

## Requirements

### Functional Requirements
- [Specific functionality that must be implemented]
- [Business rules and validation requirements]
- [Integration requirements]
- [API or interface specifications]

### Non-Functional Requirements

#### Performance
- [Only critical performance considerations that affect core functionality]

#### Security & Permissions
- [Authorization requirements]
- [Data protection needs]
- [Organization boundary enforcement]

#### User Experience
- [Core usability requirements]

#### Mobile Support
- [Responsive design requirements]
- [Mobile-specific considerations]

## Design Considerations

### Layout & UI
- [Specific layout requirements]
- [Visual hierarchy guidelines]
- [Component usage patterns]

### Responsive Behavior
- [How the interface adapts to different screen sizes]
- [Breakpoint considerations]
- [Mobile optimization requirements]

### State Management
- [How application state should be handled]
- [URL state requirements for shareability]
- [Data synchronization needs]

## Success Criteria

### Core Functionality
- [Feature works as expected for primary use cases]
- [Error handling prevents system failures]

### Technical Implementation
- [Database operations properly scoped to organizations]
- [Authentication/authorization works correctly]
- [Integration with existing systems functions properly]
```

### Step 5: Quick Review

1. **Save document to**: `specifications/[feature-area]/requirements.md`

2. **Ask for focused feedback**:
   ```
   Requirements document created at: specifications/[path]/requirements.md

   Quick check:
   - Do the user stories cover the main workflow?
   - Any missing core requirements?
   - Ready to implement or need adjustments?
   ```

## Guidelines

### Focus on Shipping
- Cover core functionality and critical edge cases
- Include error handling that prevents system failures
- Follow existing project patterns
- Get feedback quickly and iterate

### Be Specific
- Write clear user stories in given/when/then format
- Include concrete acceptance criteria
- Reference actual file paths and existing patterns

### Research Efficiently
- Read related files and existing implementations first
- Only spawn research tasks for complex features
- Verify assumptions with actual code

## Quality Checklist

Before finalizing:

- [ ] Goal addresses a clear user problem
- [ ] User stories cover core workflow and critical edge cases
- [ ] Requirements are implementable
- [ ] File paths and patterns are accurate
- [ ] Document follows template structure

## Common Patterns for MCPlatform

### Authentication Context
Always clarify which authentication system applies:
- Platform auth (dashboard users/customers)
- Sub-tenant auth (end-users of customer products)

### Data Fetching Pattern
- Server components fetch data and pass promises to client components
- Client components use `use()` hook with `<Suspense>` and `<ErrorBoundary>`
- State management with `nuqs` or similar for URL state

### Organization Scoping
- All operations must respect organization boundaries
- Include organization-level authorization in requirements
- Consider multi-tenant implications

### UI Component Standards
- Use shadcn/ui components exclusively
- Follow responsive design patterns

## Addenda:
* ask for user feedback often! Ideation is a big part of the process, and your goal is to draw as much information out of the user as possible. 
* ask probing questions, ask for clarification if you're unclear, and collaborate! make suggestions and recommendations where appropriate. 
* the user often doesn't know the answer to everything and it's ok to continue with missing pieces if you are told -- just make sure to leave a note to come back to it later
