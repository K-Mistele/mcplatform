# Example Course Content Structure

## File Naming Pattern
Files follow strict naming: `{number}-{kebab-case-title}.md`
Examples:
- `01-introduction-to-mastra.md`
- `07-creating-your-agent.md`
- `16-configuring-semantic-recall.md`

## Content Format Example 1: Introduction Step
**File:** `01-introduction-to-mastra.md`

```markdown
# Getting Started with Mastra

Welcome to the first step of building your first Mastra agent! In this lesson, you'll learn how to create a simple agent that can read data from a public Google Sheet using a custom tool function.

## What is an Agent?

An agent is software with non-deterministic code that can make autonomous decisions based on inputs and environment rather than following fixed, predictable instructions every time.

Agents are AI systems that can:

- Perceive their environment through various inputs
- Make decisions based on those inputs
- Take actions to accomplish specific goals
- Learn and adapt their behavior over time

The best agents use several important features:

1. **Memory**: They remember past interactions and learn from them
2. **Planning**: They can break down complex tasks into smaller steps
3. **Tool use**: They can leverage external tools and APIs to expand their capabilities
4. **Feedback loops**: They can evaluate their own performance and adjust accordingly
```

## Content Format Example 2: Code Implementation Step
**File:** `07-creating-your-agent.md`

```markdown
# Creating Your Agent

Let's create a simple agent that will help users analyze financial transaction data. We'll create a new file called `agents/financial-agent.ts`.

First, create the new agent file at src/mastra/agents/financial-agent.ts

Now add the necessary imports at the top of your file:

```typescript
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
// We'll import our tool in a later step
```

Now, let's create our agent:

```typescript
export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `ROLE DEFINITION
- You are a financial assistant that helps users analyze their transaction data.
- Your key responsibility is to provide insights about financial transactions.
- Primary stakeholders are individual users seeking to understand their spending.

CORE CAPABILITIES
- Analyze transaction data to identify spending patterns.
- Answer questions about specific transactions or vendors.
- Provide basic summaries of spending by category or time period.

BEHAVIORAL GUIDELINES
- Maintain a professional and friendly communication style.
- Keep responses concise but informative.
- Always clarify if you need more information to answer a question.
- Format currency values appropriately.
- Ensure user privacy and data security.

CONSTRAINTS & BOUNDARIES
- Do not provide financial investment advice.
- Avoid discussing topics outside of the transaction data provided.
- Never make assumptions about the user's financial situation beyond what's in the data.

SUCCESS CRITERIA
- Deliver accurate and helpful analysis of transaction data.
- Achieve high user satisfaction through clear and helpful responses.
- Maintain user trust by ensuring data privacy and security.`,
  model: openai("gpt-4o"), // You can use "gpt-3.5-turbo" if you prefer
  tools: {}, // We'll add tools in a later step
});
```

This creates a financial assistant agent with a well-defined system prompt that outlines its role, capabilities, behavioral guidelines, constraints, and success criteria.
```

## Directory Structure Pattern

```
docs/src/course/
├── 01-first-agent/           (18 steps)
│   ├── 01-introduction-to-mastra.md
│   ├── 02-what-is-mastra.md
│   ├── 03-verifying-installation.md
│   ├── 04-project-structure.md
│   ├── 05-running-playground.md
│   ├── 06-understanding-system-prompts.md
│   ├── 07-creating-your-agent.md
│   ├── 08-exporting-your-agent.md
│   ├── 09-testing-your-agent.md
│   ├── 10-understanding-tools.md
│   ├── 11-creating-transactions-tool.md
│   ├── 12-connecting-tool-to-agent.md
│   ├── 13-testing-your-tool.md
│   ├── 14-understanding-memory.md
│   ├── 15-installing-memory.md
│   ├── 16-adding-memory-to-agent.md
│   ├── 17-testing-memory.md
│   └── 18-conclusion.md
├── 02-agent-tools-mcp/       (32 steps)
├── 03-agent-memory/          (30 steps)
└── 04-workflows/             (22 steps)
```

## Content Writing Patterns

### 1. Step Titles
- Action-oriented: "Creating Your Agent", "Testing Your Tool"  
- Clear progression: "Understanding Memory" → "Installing Memory" → "Adding Memory to Agent"

### 2. Code Examples
- Always include imports first
- Full, runnable examples
- Clear comments explaining purpose
- Realistic use cases (financial data, content processing)

### 3. Instructions Structure
- Brief intro explaining what the step accomplishes
- Step-by-step instructions
- Code blocks with language specification
- Explanation of what the code does

### 4. Progressive Complexity
- **Lesson 1**: Basic concepts, simple agent
- **Lesson 2**: External integrations, multiple tools
- **Lesson 3**: Advanced memory features  
- **Lesson 4**: Complex workflows, orchestration

### 5. Cross-References
- Forward references: "We'll add tools in a later step"
- Backward references: "Update the configuration from step X"
- Lesson transitions in conclusion steps