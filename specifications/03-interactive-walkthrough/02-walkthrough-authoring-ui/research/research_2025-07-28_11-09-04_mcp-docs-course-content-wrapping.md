---
date: 2025-07-28 11:09:04 CDT
researcher: Claude
git_commit: 57929dfa4963f16ffc7ece65a33eac569acb4e4e
branch: main
repository: mastra
topic: "MCP Docs Server Course Content Wrapping Mechanism"
tags: [research, mcp-docs-server, course, content-wrapping, prompts]
status: complete
last_updated: 2025-07-28
last_updated_by: Claude
---

# Research: MCP Docs Server Course Content Wrapping Mechanism

**Date**: 2025-07-28 11:09:04 CDT
**Researcher**: Claude
**Git Commit**: 57929dfa4963f16ffc7ece65a33eac569acb4e4e
**Branch**: main
**Repository**: mastra

## Research Question
How are markdown source files for the MCP docs server course content wrapped with prompts or other information before being returned in MCP tool calls?

## Summary
The MCP docs server transforms raw markdown course content into guided, interactive learning experiences by wrapping each step's content with instructional prompts that define how the LLM should behave as a course instructor. The system uses a three-layer structure: instructional prompts, content isolation with XML tags, and navigation instructions.

## Content Transformation Process

### 1. Course Structure
- **Location**: `docs/src/course/` → copied to `packages/mcp-docs-server/.docs/raw/course/`
- **Hierarchy**: Lessons (numbered directories) → Steps (numbered markdown files)
- **Pattern**: `XX-lesson-name/XX-step-name.md`

### 2. Prompt Wrapping Components

#### Introduction Prompt (Registration Only)
Used only when users first register for the course:

```typescript
const introductionPrompt = `
This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
The following is the introduction content, please provide this text to the user EXACTLY as written below. Do not provide any other text or instructions:

# Welcome to the Mastra Course!

Thank you for registering for the Mastra course! This interactive guide will help you learn how to build powerful AI agents with Mastra, the open-source AI Agent framework built in TypeScript.

## Before We Begin

If you enjoy Mastra, please consider starring the GitHub repository:
https://github.com/mastra-ai/mastra

This helps the project grow and reach more developers like you!

## How This Course Works

- Each lesson is broken into multiple steps
- I'll guide you through the code examples and explanations
- You can ask questions at any time
- If you ever leave and come back, use the \`startMastraCourse\` tool to pick up where you left off. Just ask to "start the Mastra course".
- Use the \`nextMastraCourseStep\` tool to move to the next step when you're ready. Just ask to "move to the next step" when you are ready.
- Use the \`getMastraCourseStatus\` tool to check your progress. You can just ask "get my course progress".
- Use the \`clearMastraCourseHistory\` tool to reset your progress and start over. You can just ask "clear my course progress".

Type "start mastra course" and let's get started with your first lesson!
`;
```

#### Lesson Step Prompt Template
The main instructional prompt that wraps every course step:

```typescript
const lessonPrompt = `
  This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
  Please help the user through the steps of the course by walking them through the content and following the course
  to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
  as the course goes on. Each lesson is broken up into steps. You should return the content of the step and ask the user
  to move to the next step when they are ready. If the step contains instructions to write code, you should write the code
  for the user when possible. You should always briefly explain the step before writing the code. Please ensure to 
  return any text in markdown blockquotes exactly as written in your response. When the user ask about their course progress or course status,
  make sure to include the course status url in your response. This is important.
`;
```

#### Content Wrapping Function
```typescript
function wrapContentInPrompt(content: string, _isFirstStep = false): string {
  const wrappedContent = `${lessonPrompt}\n\nHere is the content for this step: <StepContent>${content}</StepContent>`;
  return `${wrappedContent}\n\nWhen you're ready to continue, use the \`nextMastraCourseStep\` tool to move to the next step.`;
}
```

## Complete Template Example

When a course step is requested, the system transforms raw markdown into this format:

```
This is a course to help a new user learn about Mastra, the open-source AI Agent framework built in Typescript.
Please help the user through the steps of the course by walking them through the content and following the course
to write the initial version of the code for them. The goal is to show them how the code works and explain it as they go
as the course goes on. Each lesson is broken up into steps. You should return the content of the step and ask the user
to move to the next step when they are ready. If the step contains instructions to write code, you should write the code
for the user when possible. You should always briefly explain the step before writing the code. Please ensure to 
return any text in markdown blockquotes exactly as written in your response. When the user ask about their course progress or course status,
make sure to include the course status url in your response. This is important.

Here is the content for this step: <StepContent><content/></StepContent>

When you're ready to continue, use the `nextMastraCourseStep` tool to move to the next step.
```

Where `<content/>` would be replaced with the actual markdown content from files like:

- `01-introduction-to-mastra.md`
- `02-what-is-mastra.md` 
- `03-verifying-installation.md`
- etc.

## Key Behavioral Instructions

The prompt instructs the LLM to:
- Act as a course instructor walking users through content
- Write code for users when possible
- Explain steps before writing code
- Return markdown blockquotes exactly as written
- Include course status URL when asked about progress
- Guide users to use `nextMastraCourseStep` tool for navigation

## Code References
- `packages/mcp-docs-server/src/tools/course.ts:41-67` - Introduction prompt definition
- `packages/mcp-docs-server/src/tools/course.ts:70-79` - Lesson step prompt template
- `packages/mcp-docs-server/src/tools/course.ts:82-85` - Content wrapping function
- `packages/mcp-docs-server/src/tools/course.ts:202-240` - Course step reading process

## Architecture Insights

### Three-Layer Structure
1. **Instructional Layer**: LLM behavior and teaching guidelines
2. **Content Layer**: Raw markdown wrapped in `<StepContent>` XML tags
3. **Navigation Layer**: Tool usage instructions for progression

### Content Isolation Strategy
- XML-style tags (`<StepContent>`) clearly separate instructions from content
- Allows LLM to distinguish between behavioral prompts and material to present
- Maintains clean separation of concerns between system prompts and course content

### Interactive Learning Design
- Static markdown becomes interactive through prompt engineering
- Consistent navigation patterns using MCP tools
- Progressive disclosure through step-by-step advancement
- State management tracks user progress across sessions

## UI/CRUD Design Implications

For building course management interfaces:

1. **Content Structure**: Simple two-level hierarchy (lessons → steps)
2. **File Naming**: Automatic `XX-kebab-case-title.md` generation
3. **Prompt Awareness**: UI should understand the wrapping mechanism exists
4. **Preview Capability**: Show both raw markdown and wrapped prompt output
5. **Template Management**: The prompt templates should be configurable
6. **Behavioral Customization**: Different course types might need different LLM instructions