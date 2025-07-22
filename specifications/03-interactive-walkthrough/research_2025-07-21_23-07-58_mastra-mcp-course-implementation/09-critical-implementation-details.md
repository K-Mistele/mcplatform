# Critical Implementation Details

## File System Conventions

### Device Storage Location
```
~/.cache/mastra/
├── .device_id              # JSON: { deviceId: string, key: string }
└── course/
    └── state.json          # CourseState JSON
```

### Course Content Directory Structure
```
{courseDir}/                # e.g., ".docs/raw/course" or your content path
├── 01-first-agent/         # Lesson directories with number prefix
│   ├── 01-step-name.md     # Step files with number prefix
│   ├── 02-step-name.md
│   └── ...
├── 02-lesson-name/
└── ...
```

## State Machine Logic

### Status Values
- `0` = NOT_STARTED (⬜)
- `1` = IN_PROGRESS (🔶) 
- `2` = COMPLETED (✅)

### State Transitions
1. **Lesson Start**: lesson.status 0→1, first step.status 0→1
2. **Step Complete**: current step.status 1→2, next step.status 0→1
3. **Lesson Complete**: all steps = 2, lesson.status = 2
4. **Course Complete**: all lessons = 2

### Critical Logic Patterns

#### Finding Current Step
```typescript
// Always find the IN_PROGRESS step (status = 1)
const currentStep = lesson.steps.find(step => step.status === 1);
```

#### Finding Next Step
```typescript  
// Find first step after current that isn't completed
const nextStepIndex = lesson.steps.findIndex(
  (step, index) => index > currentStepIndex && step.status !== 2
);
```

#### Content Loading Pattern
```typescript
// Remove number prefixes to match names
const lessonDir = lessonDirs.find(
  (dir) => dir.replace(/^\d+-/, "") === lessonName
);
const stepFile = files.find(
  (f) => f.endsWith(".md") && 
         f.replace(/^\d+-/, "").replace(".md", "") === stepName
);
```

## Authentication & Security

### Device Registration Flow
1. User provides email → POST /api/course/register
2. Server returns `{ success: boolean, id: string, key: string, message: string }`
3. Store credentials in `~/.cache/mastra/.device_id` with 0600 permissions
4. Use deviceId for identification, key for authentication

### API Authentication
- **Registration**: No auth required, just email
- **State Updates**: `x-mastra-course-key` header with stored key
- **Graceful Degradation**: Continue if server sync fails

## Content Processing Rules

### Prompt Wrapping
ALL course content gets wrapped with:
1. **Lesson Prompt**: Instructions for the AI assistant
2. **Content Tags**: `<StepContent>...</StepContent>`  
3. **Navigation Hint**: "When you're ready to continue, use the `nextMastraCourseStep` tool"

### Content Format Requirements
- **Markdown**: All content files are .md
- **Headers**: Use # for main title, ## for sections
- **Code Blocks**: Always specify language (```typescript)
- **Progressive Structure**: Each step builds on previous

## Error Handling Patterns

### Registration Errors
- No email provided → Prompt for email
- Registration failed → Return server message
- Network error → Generic retry message

### State Management Errors
- Missing device ID → "User not registered" 
- File permissions → Attempt to create directory structure
- Server sync failure → Continue with local save only

### Content Errors
- Lesson not found → List available lessons
- Step not found → Error with lesson context
- No course content → Check content directory message

## Performance Considerations

### Caching Strategy
- **Course State**: Local JSON file, sync to server
- **Content Scanning**: Re-scan on each state merge (allows content updates)
- **Device Credentials**: Cache in memory after first read

### File System Operations
- **Atomic Writes**: Write to temporary file, then rename
- **Directory Creation**: Recursive creation with proper permissions
- **Error Recovery**: Continue operation if non-critical operations fail

## MCP Protocol Specifics

### Tool Registration
```typescript
const server = new MCPServer({
  name: 'Course Server',
  version: '1.0.0',
  tools: {
    startMastraCourse,      // Main entry point
    getMastraCourseStatus,  // Progress reporting
    startMastraCourseLesson,// Direct lesson access
    nextMastraCourseStep,   // Step progression
    clearMastraCourseHistory // Reset functionality
  }
});
```

### Parameter Validation
- Use Zod schemas for all tool parameters
- Validate email format for registration
- Optional parameters for flexible interaction

### Response Patterns
- **Success**: Return formatted content or status
- **Error**: Return descriptive error message
- **Guidance**: Include next action suggestions

## Critical Dependencies

### Required Node.js Modules
```typescript
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";  // For local dev API
import os from "node:os";      // For cache directory
import path from "node:path";  // For file operations
import { z } from "zod";       // Parameter validation
```

### MCP SDK Integration
```typescript
import { MCPServer } from "@modelcontextprotocol/sdk/server/mcp.js";
```

## Environment Configuration

### Development vs Production
- **Development**: localhost:3000 API endpoints
- **Production**: https://mastra.ai/api/ endpoints
- **Content Path**: Configurable course directory location
- **Cache Location**: Always ~/.cache/mastra/

### Required Environment Setup
- Node.js with fs promises support
- Write access to user home directory
- Network access for registration and sync (optional)
- Course content directory with proper structure

## User Experience Flow

### First-Time User
1. `startMastraCourse` without email → Prompt for email
2. `startMastraCourse` with email → Register → Show introduction
3. Auto-start first lesson, first step

### Returning User  
1. `startMastraCourse` → Load state → Resume from last incomplete step
2. Handle content updates → Merge states → Preserve progress

### Navigation Patterns
- **Sequential**: `nextMastraCourseStep` for guided progression
- **Random Access**: `startMastraCourseLesson` for specific lessons
- **Status Checking**: `getMastraCourseStatus` for progress overview
- **Reset**: `clearMastraCourseHistory` for starting over

## State Consistency Rules

### State Integrity
- Only one step can be IN_PROGRESS at a time per lesson
- Lesson status must reflect step completion state
- Current lesson must exist in lessons array
- Steps array cannot be empty for valid lessons

### Update Atomicity
- Save local state before attempting server sync
- Continue on server sync failure
- Validate state structure before saving
- Handle concurrent access gracefully (file locking)