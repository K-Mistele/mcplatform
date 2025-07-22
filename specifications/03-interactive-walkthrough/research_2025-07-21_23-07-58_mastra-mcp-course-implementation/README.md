# Mastra MCP Course Implementation - Portable Code Reference

This directory contains all the code, data structures, and implementation details needed to understand and recreate Mastra's MCP course system in a separate project.

## Quick Start Guide

If you need to recreate this system, start with these files in order:

1. **`09-critical-implementation-details.md`** - Read this first to understand the overall system
2. **`01-course-types-and-interfaces.ts`** - Core data structures and types
3. **`08-complete-tool-implementations.ts`** - The five main MCP tools
4. **`03-state-management-core.ts`** - How state is stored and managed
5. **`04-api-communication.ts`** - Registration and sync APIs
6. **`05-content-scanning-and-loading.ts`** - How content is discovered and loaded
7. **`06-course-prompts-and-templates.ts`** - All prompts and status formatting

## File Overview

### Core Implementation
- **`01-course-types-and-interfaces.ts`** - TypeScript types, Zod schemas, and data structures
- **`02-mcp-server-setup.ts`** - MCP server initialization patterns
- **`03-state-management-core.ts`** - Device credentials and course state management
- **`08-complete-tool-implementations.ts`** - All five course tools fully implemented

### Communication & Content
- **`04-api-communication.ts`** - Registration and sync API implementations (both dev and prod)
- **`05-content-scanning-and-loading.ts`** - Content discovery, loading, and state merging logic
- **`06-course-prompts-and-templates.ts`** - All prompts, templates, and status reporting

### Documentation & Examples
- **`07-example-course-content.md`** - Content structure examples and authoring patterns
- **`09-critical-implementation-details.md`** - File system conventions, state machine logic, error handling
- **`10-package-json-and-dependencies.json`** - Required dependencies and package configuration

## Key System Components

### Data Flow
1. **Registration**: User provides email → gets device ID + key → stored locally
2. **Content Loading**: Scan filesystem → build course state → merge with user progress
3. **State Management**: Local JSON file + server sync → atomic updates
4. **Tool Interaction**: MCP tools → state transitions → content delivery

### State Machine
- **Statuses**: 0=not started, 1=in progress, 2=completed
- **Hierarchy**: Course → Lessons → Steps
- **Transitions**: Linear progression with jump capabilities
- **Persistence**: Local-first with optional server sync

### File System Layout
```
~/.cache/mastra/
├── .device_id              # Device authentication
└── course/state.json       # Course progress

{courseDir}/                # Content directory
├── 01-lesson-name/         # Numbered lesson dirs
│   ├── 01-step-name.md     # Numbered step files  
│   └── ...
└── ...
```

## API Endpoints

### Registration
```typescript
POST https://mastra.ai/api/course/register
Body: { email: string }
Response: { success: boolean, id: string, key: string, message: string }
```

### State Sync
```typescript
POST https://mastra.ai/api/course/update
Headers: { "x-mastra-course-key": string }
Body: { id: string, state: CourseState }
Response: 200 OK
```

## Dependencies

### Core Requirements
- Node.js 18+
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation
- Native Node.js modules: `fs`, `http`, `os`, `path`

### Development
- TypeScript 5+
- Vitest for testing

## Content Authoring

### File Naming
- Lessons: `01-lesson-name/`
- Steps: `01-step-name.md`
- Numbers ensure ordering, names used for identification

### Content Format
- Markdown with TypeScript code blocks
- Progressive complexity and scaffolded learning  
- Clear action-oriented titles
- Full, runnable code examples with imports

## For Remote HTTP MCP Implementation

### Key Adaptations Needed
1. **HTTP Transport**: Replace stdio with HTTP endpoints
2. **Server-Side State**: Move from local files to database
3. **Streaming**: Add real-time progress updates
4. **Authentication**: Adapt device credential system for web
5. **Content Management**: Consider CDN for content delivery

### Preserved Patterns
- Tool interface and parameter validation
- State machine logic and status transitions
- Content wrapping and prompt templates
- Progress tracking and navigation flows
- Error handling and graceful degradation

## Usage

This code is designed to be self-contained and portable. To use in another project:

1. Copy this entire directory to your project
2. Install dependencies from `10-package-json-and-dependencies.json`
3. Adapt file paths and API endpoints to your environment
4. Implement your content directory structure
5. Follow the patterns in `08-complete-tool-implementations.ts`

The research document (`../research_2025-07-21_23-07-58_mastra-mcp-course-implementation.md`) provides additional context and analysis.