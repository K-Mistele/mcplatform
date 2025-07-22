# Interactive Walkthrough Feature

## Overview

The Interactive Walkthrough feature enables MCPlatform customers to create guided, step-by-step experiences for their end-users directly within AI-powered IDEs and tools like Claude Code and Cursor. This feature allows customers to author structured learning content that is delivered through their MCP servers, providing contextual guidance and improving user onboarding and feature adoption.

## Business Value

### For MCPlatform Customers
- **Improved User Onboarding**: Guide new users through complex onboarding workflows step-by-step; e.g. configuration creation, instrumenting code with SDKs, and more.
- **Feature Discovery**: Help users discover and learn advanced features they might otherwise miss
- **Reduced Support Load**: Proactive guidance reduces the need for reactive support
- **User Engagement**: Interactive content keeps users engaged longer with the product
- **Analytics Insights**: Track which parts of the user journey cause friction or confusion

### For End-Users
- **Contextual Learning**: Learn directly in their development environment without context switching
- **AI-assisted onboarding**: the code editor's agent can scaffold out code, create configurations, instrument code with SDKs, and delivery proactive context and guidance.
- **Self-Paced Progress**: Move through content at their own speed
- **Progressive Disclosure**: Information is presented when needed, reducing cognitive load
- **Consistent Experience**: Standardized guidance across different features and workflows

## Core Functionality

### Walkthrough Management (Dashboard)
- **Independent Creation**: Walkthroughs are created and managed in a dedicated "Walkthroughs" section, separate from MCP servers
- **Step Authoring**: Each walkthrough consists of multiple steps with Markdown content
- **Content Editing**: Rich markdown editor with preview capabilities
- **Step Ordering**: Flexible linked-list structure allows easy reordering and insertion
- **Versioning**: Content can be updated without breaking user progress
- **Preview Mode**: Test the walkthrough experience before publishing
- **Server Assignment**: Flexible many-to-many relationship - each walkthrough can be assigned to multiple MCP servers, and each server can have multiple walkthroughs
- **Display Control**: Control ordering and enable/disable status per server assignment

### User Experience (MCP Tools)
- **Discovery Selection**: `list_walkthroughs` tool shows all walkthroughs available on the current MCP server
- **Walkthrough Selection**: `select_walkthrough` tool allows users to start or resume a specific walkthrough
- **Navigation**: `next_walkthrough_step` tool advances through the selected walkthrough's steps
- **Progress Tracking**: System remembers where users left off across different IDE sessions
- **Completion Tracking**: Analytics on user progress and completion rates
- **OAuth Authorization**: Users authorize with OAuth to ensure their progress can be saved and support can be proactively contacted when they need help

### State Management
- **Server-Side State**: All progress and content stored on MCPlatform servers
- **User Progress**: Track current step and completion status per user per walkthrough
- **Session Persistence**: Users can resume walkthroughs across different IDE sessions
- **Version Compatibility**: Handle content updates gracefully without losing user progress

## Technical Architecture

### Data Storage
- **Content Storage**: Markdown content stored in PostgreSQL (with future S3 migration path)
- **Linked List Structure**: Steps connected via `next_step_id` for flexible ordering
- **Many-to-Many Architecture**: Junction table enables flexible walkthrough-server assignments
- **Progress Tracking**: User progress stored per walkthrough with version tracking
- **Multi-Tenancy**: All data properly scoped to organizations

### System Integration
- **MCP Tools**: Three new tools added to existing MCP servers (not new HTTP endpoints)
- **Dashboard Integration**: New dedicated "Walkthroughs" sidebar section with assignment management using oRPC server actions

### Database Schema
Four new tables:
- `walkthroughs`: Organization-scoped walkthrough metadata and versioning
- `mcp_server_walkthroughs`: Junction table for many-to-many server-walkthrough assignments
- `walkthrough_steps`: Individual step content in linked-list structure
- `walkthrough_progress`: User progress tracking with server context and version compatibility

## User Stories

### Customer (Dashboard User)
- As a customer, I want to create walkthroughs independently of my MCP servers so I can manage content efficiently
- As a customer, I want to assign the same walkthrough to multiple MCP servers so I can reuse content across different contexts
- As a customer, I want to control which walkthroughs appear on each server and in what order so I can tailor the experience per server
- As a customer, I want to edit walkthrough content using a markdown editor so I can create rich, formatted guidance
- As a customer, I want to reorder steps easily so I can refine the learning flow
- As a customer, I want to preview my walkthrough so I can test the user experience before publishing
- As a customer, I want to temporarily disable a walkthrough on specific servers without deleting the assignment
- As a customer, I want to see analytics on walkthrough usage across all my servers so I can understand user behavior

### End-User (MCP Tool User)
- As an end-user, I want to see what walkthroughs are available so I can choose relevant guidance
- As an end-user, I want to start a walkthrough and have it guide me step-by-step through a process
- As an end-user, I want to resume a walkthrough where I left off so I don't lose progress
- As an end-user, I want to navigate through steps at my own pace so I can learn effectively

## Success Metrics

### Engagement Metrics
- Number of walkthroughs created per customer
- Walkthrough start rate (% of users who start at least one walkthrough)
- Step completion rate (average steps completed per walkthrough)
- Walkthrough completion rate (% of started walkthroughs that are finished)

### Business Impact
- Reduction in support ticket volume for customers using walkthroughs
- Increased user retention for MCP servers with walkthroughs
- Time to first value (how quickly new users achieve success)

## Implementation Phases

### Phase 1: Core Infrastructure
- Database schema implementation
- Basic CRUD operations for walkthroughs and steps
- MCP tool implementations (`list_walkthroughs`, `select_walkthrough`, `next_walkthrough_step`)
- Basic progress tracking

### Phase 2: Dashboard UI
- New "Walkthroughs" sidebar section independent of servers
- Walkthrough list and creation flow
- Step editor with markdown support
- Server assignment management interface
- Basic preview functionality

### Phase 3: Enhanced Features
- Advanced markdown editor with syntax highlighting
- Drag-and-drop step reordering
- Drag-and-drop walkthrough assignment and ordering on servers
- Walkthrough analytics dashboard with cross-server insights
- Version management UI

### Phase 4: Advanced Capabilities
- Walkthrough templates
- Rich media support (images, code snippets)
- Conditional branching
- A/B testing capabilities

## Technical Considerations

### Performance
- Efficient querying of linked-list step structure
- Caching strategies for frequently accessed content
- Optimistic updates for real-time editing experience

### Security
- Proper authorization for walkthrough management (organization-scoped)
- Content sanitization for markdown input
- Rate limiting for MCP tool calls

### Scalability
- Database indexing strategy for progress queries
- Content delivery optimization
- Migration path to object storage for large content

## Dependencies

### Internal
- Existing MCP server infrastructure
- Dashboard authentication and authorization
- Database migration system
- Analytics infrastructure

### External
- Markdown parsing and rendering libraries
- Rich text editor component
- Drag-and-drop UI library

## Risks and Mitigations

### Risk: Content Versioning Complexity
**Mitigation**: Start with simple integer versioning, design schema to support more complex versioning later

### Risk: User Experience Consistency
**Mitigation**: Extensive testing across different IDE environments, clear documentation for customers

### Risk: Performance with Large Content
**Mitigation**: Implement pagination for step lists, lazy loading for content, monitoring for query performance

## Definition of Done

### Phase 1 Complete When:
- [ ] Database schema implemented and migrated
- [ ] All three MCP tools functional and tested
- [ ] Basic progress tracking working
- [ ] oRPC server actions for CRUD operations implemented
- [ ] Unit tests covering core functionality

### Phase 2 Complete When:
- [ ] Dashboard UI fully functional
- [ ] Customers can create, edit, and delete walkthroughs
- [ ] Step editor with markdown preview working
- [ ] Integration tests covering full user flows
- [ ] Documentation for customers on how to use the feature

### Feature Complete When:
- [ ] All planned functionality implemented
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Customer feedback incorporated
- [ ] Analytics tracking implemented
- [ ] Feature flag system in place for gradual rollout