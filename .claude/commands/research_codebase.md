# Research Codebase

You are tasked with conducting comprehensive research across the codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (tickets, docs, JSON), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using TodoWrite to track all subtasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Spawn parallel sub-agent tasks for comprehensive research:**
   - Create multiple Task agents to research different aspects concurrently
   - Always include these parallel tasks:
     - **Codebase exploration tasks** (one for each relevant component/directory)
     - **Thoughts directory exploration task** (to find historical context and insights)
   - Optionally include if it makes sense for the task:
     - **Web Research tasks** (only if the user explicitly asks you to search the web)
   - Each codebase sub-agent should focus on a specific directory, component, or question
   - Write detailed prompts for each sub-agent following these guidelines:
     - Instruct them to use READ-ONLY tools (Read, Grep, Glob, LS)
     - Ask for specific file paths and line numbers
     - Request they identify connections between components
     - Have them note architectural patterns and conventions
     - Ask them to find examples of usage or implementation
   - Example codebase sub-agent prompt:
     ```
     Research [specific component/pattern] in [directory/module]:
     1. Find all files related to [topic]
     2. Identify how [concept] is implemented (include file:line references)
     3. Look for connections to [related components]
     4. Find examples of usage in [relevant areas]
     5. Note any patterns or conventions used
     6. Use only READ-ONLY tools (Read, Grep, Glob, LS)
     Return: File paths, line numbers, code patterns found, and concise explanations of findings
     ```
   - Example web sub-agent prompt (only create if user explicitly asks for web search):
     ```
     Research [specific component/pattern] using WebSearch and/or WebFetch:
     1. Find all pages related to [topic]
     2. Identify how [concept] could be implemented (include page:quotation references)
     3. Look for connections to [related components]
     4. Find examples of usage in [relevant areas]
     5. Note any patterns or conventions used
     6. Use only WEB TOOLS (WebFetch, WebSearch) and READ-ONLY tools (Read, Grep, Glob, LS)
     Return: web pages, exact quotations, and concise explanations of findings
     ```

   - Thoughts directory sub-agent prompt:
     ```
     Explore the `specifications/thoughts` and `specifications/feature-name/thoughts` directory for context related to [topic]:
     1. Search for any relevant information in specifications/
     2. Look for design decisions, past research, PR descriptions, or implementation notes
     3. Find any historical context about [specific components/patterns]
     4. Note any architectural decisions or trade-offs discussed
     Remember: This information is historical context, not current truth
     ```

4. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results (both codebase and thoughts findings)
   - Prioritize live codebase findings as primary source of truth
   - Use thoughts/ findings as supplementary historical context
   - Connect findings across different components
   - Include specific file paths and line numbers for reference
   - Verify all thoughts/ paths are correct (e.g., thoughts/allison/ not thoughts/shared/ for personal files)
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

5. **Gather metadata for the research document:**
   - Run the `scripts/spec_metadata.sh` script to generate all relevant metadata
   - Filename: should be under the `specification` directory for the feature that you're currently working on, e.g. `specification/01-better-session-support/`, or under `specification/general` if you don't hav einformation about which feature you're working on. Name the file `research_YYYY-MM-DD_HH-MM-SS_topic.md`

6. **Generate research document:**
   - Use the metadata gathered in step 4
   - Structure the document with YAML frontmatter followed by content:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher name from thoughts status]
     git_commit: [Current commit hash]
     branch: [Current branch name]
     repository: [Repository name]
     topic: "[User's Question/Topic]"
     tags: [research, codebase, relevant-component-names]
     status: complete
     last_updated: [Current date in YYYY-MM-DD format]
     last_updated_by: [Researcher name]
     type: research
     ---

     # Research: [User's Question/Topic]

     **Date**: [Current date and time with timezone from step 4]
     **Researcher**: [Researcher name from thoughts status]
     **Git Commit**: [Current commit hash from step 4]
     **Branch**: [Current branch name from step 4]
     **Repository**: [Repository name]

     ## Research Question
     [Original user query]

     ## Summary
     [High-level findings answering the user's question]

     ## Detailed Findings

     ### [Component/Area 1]
     - Finding with reference ([file.ext:line](link))
     - Connection to other components
     - Implementation details

     ### [Component/Area 2]
     ...

     ## Code References
     - `path/to/file.py:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## Architecture Insights
     [Patterns, conventions, and design decisions discovered]

     ## Historical Context (from thoughts/)
     [Relevant insights from thoughts/ directory with references]
     - `specification/thoughts/something.md` or `specification/feature-name/thoughts/something.md`- Historical decision about X
     - `specification/thoughts/notes.md` or `specification/feature-name/thoughts/notes.md` - Past exploration of Y

     ## Related Research
     [Links to other research documents in `specification/` or `specification/thoughts/`]

     ## Open Questions
     [Any areas that need further investigation]
     ```

7. **Add GitHub permalinks (if applicable):**
   - Check if on main branch or if commit is pushed: `git branch --show-current` and `git status`
   - If on main/master or pushed, generate GitHub permalinks:
     - Get repo info: `gh repo view --json owner,name`
     - Create permalinks: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`
   - Replace local file references with permalinks in the document

8. **Sync and present findings:**
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

9. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Update the frontmatter fields `last_updated` and `last_updated_by` to reflect the update
   - Add `last_updated_note: "Added follow-up research for [brief description]"` to frontmatter
   - Add a new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed for additional investigation
   - Continue updating the document and syncing

## Important notes:
- Always use parallel Task agents to maximize efficiency and minimize context usage
- Always run fresh codebase research - never rely solely on existing research documents
- The thoughts/ directory provides historical context to supplement live findings
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only operations
- Consider cross-component connections and architectural patterns
- Include temporal context (when the research was conducted)
- Link to GitHub when possible for permanent references
- Keep the main agent focused on synthesis, not deep file reading
- Encourage sub-agents to find examples and usage patterns, not just definitions
- Explore all of thoughts/ directory, not just research subdirectory
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read mentioned files first before spawning sub-tasks (step 1)
  - ALWAYS wait for all sub-agents to complete before synthesizing (step 4)
  - ALWAYS gather metadata before writing the document (step 5 before step 6)
  - NEVER write the research document with placeholder values
- **Frontmatter consistency**:
  - Always include frontmatter at the beginning of research documents
  - Keep frontmatter fields consistent across all research documents
  - Update frontmatter when adding follow-up research
  - Use snake_case for multi-word field names (e.g., `last_updated`, `git_commit`)
  - Tags should be relevant to the research topic and components studied