---
date: 2025-07-28 17:30:00 CDT
author: Claude
git_commit: current
branch: master
repository: mcplatform
topic: "Structured Content Architecture for Walkthrough Steps"
tags: [architecture, content-structure, authoring-ui, template-system]
status: complete
last_updated: 2025-07-28T15:32:54-05:00
last_updated_by: Claude
type: architecture_documentation
---

# Structured Content Architecture for Walkthrough Steps

## Overview

Based on research into Mastra's MCP course implementation and analysis of effective interactive learning patterns, we've designed a structured content architecture that transforms raw authoring input into AI-optimized instructional content. This approach provides better AI agent performance while maintaining a superior authoring experience.

## The Problem with Raw Markdown

Mastra's current approach wraps raw markdown in basic instructional prompts:

```
This is a course to help a new user learn about Mastra...
Here is the content for this step: <StepContent>[raw markdown]</StepContent>
When you're ready to continue, use the nextMastraCourseStep tool...
```

**Limitations:**
- No structure guidance for AI agents
- Authors must remember to include all necessary elements
- Inconsistent results across different content types
- Limited ability to customize AI behavior per step type

## Our Structured Approach

### Database Schema Foundation

The content is stored as versioned JSONB in PostgreSQL:

```typescript
// packages/database/src/schema.ts
export const walkthroughStepContentFieldVersion1 = z.object({
    version: z.literal('v1'),
    introductionForAgent: z.string().optional()
        .describe('Information about the step and what should be done'),
    contextForAgent: z.string().optional()
        .describe('Context and where/how the agent can find more information'),
    contentForUser: z.string()
        .describe('The specifics of what the agent should say/tell the user'),
    operationsForAgent: z.string()
        .describe('CRUD operations on files, tools, MCP tools etc.')
})

// Stored in walkthroughSteps.contentFields as JSONB
contentFields: jsonb('content_fields')
    .$type<z.infer<typeof walkthroughStepContentField>>()
    .notNull()
    .default({
        version: 'v1',
        introductionForAgent: '',
        contextForAgent: '',
        contentForUser: '',
        operationsForAgent: ''
    })
```

### Content Structure Design

Each step is broken into four distinct sections:

#### 1. Introduction for Agent
**Purpose**: Provides the AI agent with context about what this step accomplishes
**Content**: Brief explanation of the step's learning objectives and expected outcomes
**Example**:
```
Guide the user through creating their first Mastra agent. This step focuses on setting up the basic agent structure and understanding the core concepts of AI agents before moving into tool integration.
```

#### 2. Context for Agent  
**Purpose**: Background knowledge and search terms the agent can use
**Content**: Key concepts, references, related documentation, search terms
**Example**:
```
Key concepts: AI agents, autonomous decision-making, tool use, memory systems
Related docs: /docs/agents/overview, /docs/getting-started
Search terms: "Mastra agent", "AI agent framework", "agent tools"
File locations: src/agents/, examples/financial-agent/
```

#### 3. Content for User
**Purpose**: The actual instructional content to present to the user
**Content**: Step-by-step instructions, explanations, code examples
**Example**:
```markdown
# Creating Your Financial Agent

Let's create a simple agent that will help users analyze financial transaction data. 

First, create the new agent file at `src/mastra/agents/financial-agent.ts`

```typescript
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `You are a financial assistant that helps users analyze transaction data...`,
  model: openai("gpt-4o"),
  tools: {}, // We'll add tools in the next step
});
```

This creates a financial assistant agent with a well-defined system prompt.
```

#### 4. Operations for Agent
**Purpose**: Specific actions the agent should perform
**Content**: File operations, tool calls, validations, etc.
**Example**:
```
CREATE: src/mastra/agents/financial-agent.ts
READ: Check if src/mastra/ directory exists, create if missing
VALIDATE: Ensure agent imports are correct
NEXT_STEP_PREP: Mention that tools will be added in the next step
```

## Template System Architecture

### Template Engine Choice
We'll use **Nunjucks** for template rendering:
- More powerful than Handlebars with better loops and conditionals
- JavaScript-native with no compilation step required
- Template inheritance and advanced filtering
- Closer to Jinja syntax for familiarity

### Template Structure

The final content template combines all sections:

```nunjucks
{# Agent Instruction Prompt #}
This is an interactive walkthrough to guide users through {{ walkthroughTitle }}. 
You are an expert instructor helping users learn step by step.

{% if introductionForAgent %}
## Step Context
{{ introductionForAgent }}
{% endif %}

{% if contextForAgent %}
## Background Information
{{ contextForAgent }}
{% endif %}

{% if operationsForAgent %}
## Operations to Perform
{{ operationsForAgent }}
{% endif %}

## User Content
Present the following content to the user, following the instructions above:

<StepContent>
{{ contentForUser }}
</StepContent>

## Navigation
When the user is ready to continue, guide them to use the appropriate walkthrough navigation tools.
```

### Template Processing Pipeline

```typescript
// Template processing flow
interface TemplateData {
    walkthroughTitle: string;
    stepTitle: string;
    stepNumber: number;
    totalSteps: number;
    introductionForAgent?: string;
    contextForAgent?: string;
    contentForUser: string;
    operationsForAgent?: string;
}

// Template rendering function using Nunjucks
function renderStepContent(
    stepData: WalkthroughStep, 
    walkthroughData: Walkthrough
): string {
    const template = nunjucks.getTemplate('walkthrough-step.njk');
    const templateData: TemplateData = {
        walkthroughTitle: walkthroughData.title,
        stepTitle: stepData.title,
        stepNumber: stepData.displayOrder,
        totalSteps: walkthroughData.totalSteps,
        ...stepData.contentFields
    };
    
    return template.render(templateData);
}
```

## UI/UX Design Implications

### Authoring Interface

The authoring UI presents four distinct form sections:

```typescript
interface StepEditorProps {
    step: WalkthroughStep;
    onSave: (content: WalkthroughStepContentField) => void;
}

// Three-Panel Editor Layout:
// ┌──────────────────────────────────────────────────┐
// │ Header: Walkthrough Metadata + Actions          │
// ├──────────────────────────────────────────────────┤
// │ ┌────────────┐ ┌─────────────────┐ ┌──────────┐ │
// │ │ Steps      │ │ Content Editor  │ │ Preview  │ │
// │ │ Navigator  │ │                 │ │ Panel    │ │
// │ │            │ │ Step Title:     │ │          │ │
// │ │ □ Step 1   │ │ [Input Field]   │ │ [Edit]   │ │
// │ │ □ Step 2   │ │                 │ │ [Preview]│ │
// │ │ □ Step 3   │ │ 📋 Introduction │ │          │ │
// │ │            │ │ [Collapsible]   │ │ Template │ │
// │ │ [+ Add]    │ │                 │ │ Output   │ │
// │ │            │ │ 🔍 Context      │ │          │ │
// │ │            │ │ [Collapsible]   │ │          │ │
// │ │            │ │                 │ │          │ │
// │ │            │ │ 👤 Content      │ │          │ │
// │ │            │ │ [Always Open]   │ │          │ │
// │ │            │ │                 │ │          │ │
// │ │            │ │ ⚡ Operations   │ │          │ │
// │ │            │ │ [Collapsible]   │ │          │ │
// │ └────────────┘ └─────────────────┘ └──────────┘ │
// └──────────────────────────────────────────────────┘
```

### Preview Capabilities

The three-panel layout provides real-time preview in the right panel:

1. **Edit Mode**: Simple shadcn/ui textareas for all content fields in center panel
2. **Preview Mode**: Rendered Nunjucks template output in right panel
3. **Real-time Updates**: Preview updates automatically as content is edited
4. **Navigation**: Previous/Next step controls in preview panel

### Validation and Guidance

**Field Validation:**
- `contentForUser` is required (primary instructional content)
- Other fields are optional but encouraged
- Character limits with visual indicators
- Markdown validation for user content

**Contextual Help:**
- Tooltips explaining each section's purpose
- Examples and templates for common step types
- Real-time preview of template output

## Benefits of This Architecture

### For Content Authors
- **Guided Creation**: Clear structure prevents forgetting important elements
- **Consistency**: All steps follow the same pattern
- **Flexibility**: Optional fields allow for different step types
- **No Syntax Learning**: No need to remember XML markup

### For AI Agents
- **Clear Instructions**: Structured guidance on what to do
- **Rich Context**: Background information for better responses
- **Specific Operations**: Clear action items to perform
- **Consistent Behavior**: Predictable AI responses across steps

### For Platform Developers
- **Version Management**: Easy to evolve content structure
- **Template Flexibility**: Can modify rendering without touching content
- **Analytics**: Can track which sections are most/least used
- **A/B Testing**: Can test different template variations

## Implementation Considerations

### Technical Requirements
- JSONB schema support (already implemented)
- Nunjucks template rendering system
- Three-panel editor layout (navigator, editor, preview)
- Real-time preview panel with template rendering
- Auto-save functionality with visual feedback
- Content validation and character limits

### UI Considerations
- Use shadcn/ui textareas for all content fields in collapsible sections
- Implement three-panel layout with real-time preview
- Include walkthrough type selector in creation/edit forms
- Focus on content structure over rich editing features
- Ensure responsive design for mobile authoring (collapse to single panel)
- Provide contextual help and field descriptions
- Show type-specific field requirements and templates
- Preview updates dynamically in real-time as content is edited

## Walkthrough Types and Templates

### Type-Based Template System

Different walkthrough types require different templates and content emphasis:

```typescript
// Walkthrough types defined in database schema
export const walkthroughTypeValues = ['course', 'installer', 'troubleshooting', 'integration', 'quickstart'] as const;
export type WalkthroughType = typeof walkthroughTypeValues[number];

// Template configuration per walkthrough type
interface WalkthroughTemplateConfig {
    type: WalkthroughType;
    name: string;
    description: string;
    templatePath: string;
    requiredFields: (keyof WalkthroughStepContentFieldVersion1)[];
    optionalFields: (keyof WalkthroughStepContentFieldVersion1)[];
    defaultPromptStyle: string;
}

const typeTemplates: WalkthroughTemplateConfig[] = [
    {
        type: 'course',
        name: 'Interactive Course',
        description: 'Educational content with progressive learning',
        templatePath: 'templates/course-walkthrough.njk',
        requiredFields: ['contentForUser'],
        optionalFields: ['introductionForAgent', 'contextForAgent', 'operationsForAgent'],
        defaultPromptStyle: 'educational-instructor'
    },
    {
        type: 'installer',
        name: 'Installation Guide',
        description: 'Step-by-step installation and setup',
        templatePath: 'templates/installer-walkthrough.njk',
        requiredFields: ['contentForUser', 'operationsForAgent'],
        optionalFields: ['introductionForAgent', 'contextForAgent'],
        defaultPromptStyle: 'technical-assistant'
    },
    {
        type: 'troubleshooting',
        name: 'Troubleshooting Guide',
        description: 'Problem diagnosis and resolution',
        templatePath: 'templates/troubleshooting-walkthrough.njk',
        requiredFields: ['contentForUser', 'contextForAgent'],
        optionalFields: ['introductionForAgent', 'operationsForAgent'],
        defaultPromptStyle: 'diagnostic-helper'
    },
    {
        type: 'integration',
        name: 'Integration Guide',
        description: 'Connecting with external tools and services',
        templatePath: 'templates/integration-walkthrough.njk',
        requiredFields: ['contentForUser', 'contextForAgent', 'operationsForAgent'],
        optionalFields: ['introductionForAgent'],
        defaultPromptStyle: 'integration-specialist'
    },
    {
        type: 'quickstart',
        name: 'Quick Start',
        description: 'Fast-track setup and basic usage',
        templatePath: 'templates/quickstart-walkthrough.njk',
        requiredFields: ['contentForUser'],
        optionalFields: ['introductionForAgent', 'contextForAgent', 'operationsForAgent'],
        defaultPromptStyle: 'concise-guide'
    }
];
```

### Type-Specific Template Examples

#### Course Template
```nunjucks
{# Educational, patient instruction style #}
This is an interactive course to help users learn {{ walkthroughTitle }}.
You are an expert instructor. Take time to explain concepts thoroughly.

{% if introductionForAgent %}
## Learning Objectives
{{ introductionForAgent }}
{% endif %}

{% if contextForAgent %}
## Background Knowledge
{{ contextForAgent }}
{% endif %}

<StepContent>
{{ contentForUser }}
</StepContent>

{% if operationsForAgent %}
## Practice Exercises
{{ operationsForAgent }}
{% endif %}
```

#### Installer Template
```nunjucks
{# Technical, precise instruction style #}
This is an installation guide for {{ walkthroughTitle }}.
You are a technical assistant. Be precise and verify each step.

{% if introductionForAgent %}
## Installation Context
{{ introductionForAgent }}
{% endif %}

{% if contextForAgent %}
## Prerequisites and Requirements
{{ contextForAgent }}
{% endif %}

<StepContent>
{{ contentForUser }}
</StepContent>

{% if operationsForAgent %}
## Required Actions
{{ operationsForAgent }}

IMPORTANT: Verify each operation completes successfully before proceeding.
{% endif %}
```

## Content Migration Strategy

### Handling Existing Content

For any existing raw markdown content:

```typescript
// Migration function for legacy content
function migrateRawMarkdownToStructured(
    rawMarkdown: string
): WalkthroughStepContentFieldVersion1 {
    return {
        version: 'v1',
        introductionForAgent: '', // Leave empty, to be filled by authors
        contextForAgent: '', // Leave empty, to be filled by authors  
        contentForUser: rawMarkdown, // Preserve existing content
        operationsForAgent: '' // Leave empty, to be filled by authors
    };
}
```

### Gradual Enhancement

Authors can gradually enhance their content:
1. Start with migrated content (everything in `contentForUser`)
2. Add agent instructions as they understand the benefits
3. Refine and optimize based on AI agent performance

## Conclusion

This structured content architecture provides the foundation for superior interactive walkthroughs while maintaining authoring simplicity. The versioned JSONB storage ensures we can evolve the structure over time, while the template system allows for flexible presentation without requiring content rewrites.

The separation of concerns between what authors write and how AI agents consume that content enables both better authoring experiences and more effective AI instruction, ultimately leading to better user learning outcomes.