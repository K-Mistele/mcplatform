# create_handoff.md - Mcplatform handoff task 

You are tasked with writing a handoff document to hand off your work to another agent. You will create a handoff document that is thorough, but also **concise**. The goal is to compact and summarize your context without losing any of the key details of what you're working on.

## Process
1. **Filepath & Metadata**
    - create your file under `specification/[feature]/handoffs/handoff-N.md` where `N` is an integer incremented from the previous handoff if there is one, e.g. `handoff-0.md`, `handoff-1.md`, etc. -- look for existing handoff documents in that folder if it exists before writing a new one to avoid mis-numbering the file.
    - if you are working on a subfeature, use `specification/[feature]/[subfeature]/handoffs/handoff-N.md` using the same convention.
    - Run the `scripts/spec_metadata.sh` script to generate all relevant metadata

2. **Create your document**
    - using the above conventions, write your document. use the defined filepath, and the following YAML frontmatter pattern:
    - Use the metadata gathered in step 1
   - Structure the document with YAML frontmatter followed by content:
```markdown
---
date: [Current date and time with timezone in ISO format]
researcher: [Researcher name from thoughts status]
git_commit: [Current commit hash]
branch: [Current branch name]
repository: [Repository name]
topic: "[Feature/Task Name] Implementation Strategy"
tags: [implementation, strategy, relevant-component-names]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
last_updated_by: [Researcher name]
type: implementation_strategy
---
```

3. **Write  the document**
    - use the following template: 
```markdown
# Handoff: {brief description of feature/task}
## Task(s)
{description of the task(s) that you were working on, along with the status of each (completed, work in progress, planned/discussed)}

## Recent changes
{describe recent changes made to the codebase that you made}

## Learnings
{describe important things that you learned - e.g. patterns, root causes of bugs, or other important pieces of information someone that is picking up your work after you should know. consider listing explicit file paths.}

## Artifacts
{ an exhaustive list of artifacts you produced or updated as filepaths - e.g. paths to feature documents, implementation plans, etc that should be read in order to resume your work.}

## Action Items & Next Steps
{ a list of action items and next steps for the next agent to accomplish based on your tasks and their statuses}

## Other Notes
{ other notes, references, or useful information - e.g. where relevant sections of the codebase are, where relevant documents are, or other important things you leanrned that you want to pass on but that don't fall into the above categories}
```

## Additional Notes & Instructions
- **more information, not less**. This is a guideline that defines the minimum of what a handoff should be. Always feel free to include more information if necessary.
- **be thorough and precise**. include both top-level objectives, and lower-level details as necessary.
- **avoid excessive code snippets**. While a brief snippet to describe some key change is important, avoid large code blocks or diffs; do not include one unless it's absolutely necessary. Prefer using `/path/to/file.ext:line` references that an agent can follow later when it's ready, e.g. `packages/dashboard/src/app/dashboard/page.tsx:12-24`
