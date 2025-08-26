---
date: 2025-08-05T12:06:56-07:00
researcher: Claude
git_commit: 4bc633cfd1daf4be5f333f2fb08ccebe9ffcb733
branch: master
repository: mcplatform
topic: "Standalone Installation Demo Page Feature Specification"
tags: [feature, requirements, specification, installation, demo, html, cursor-integration]
status: complete
last_updated: 2025-08-05
last_updated_by: Claude
type: feature
---

# Standalone Installation Demo Page Feature

## Overview
A simple, standalone HTML demo page that mimics a documentation site with an embedded "Install to Cursor" button, demonstrating the MCP server installation flow without requiring the full MCPlatform infrastructure. This serves as a proof-of-concept for how customers could integrate MCP installation into their own documentation sites.

## Business Value

### For MCPlatform Customers
- Provides a clear example of how to embed MCP installation buttons in their documentation
- Demonstrates the simplicity of the integration without complex dependencies
- Shows how tracking IDs can be incorporated for user analytics
- Enables testing of installation flows without full platform setup

### For End-Users
- Familiar documentation site experience with integrated tooling installation
- One-click installation directly from documentation context
- Clear visual indicators for installation options
- No authentication or account creation required for basic installation

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The existing MCP installation system uses the `CursorInstallLink` component (`src/components/cursor-install-link.tsx`) which generates installation links with base64-encoded configurations. The system uses vhost-based routing where MCP servers are accessed via subdomains.

### Composition Pattern
This will be a standalone HTML file with inline CSS and JavaScript, not following the React/Next.js patterns of the main application. It will use plain HTML anchor tags for the installation link.

### Data Model
No database interaction required - this is a static HTML demonstration page.

## User Stories
(in given/when/then format)

### Documentation Visitors
1. **Developer browsing docs**: **Given** a developer is reading Next.js installation documentation, **when** they see the "Install to Cursor" button, **then** they can click it to install the MCP server to their Cursor IDE - The button should be visually prominent and contextually placed


## Core Functionality

### Documentation Layout
- Sidebar navigation with multiple documentation sections (mocked)
- Main content area displaying Next.js installation guide
- Clean, professional styling without external dependencies (HTML / CSS ONLY)

### Installation Button Integration
- "Install to Cursor" button embedded within documentation content, at the top of the page.
- Includes tracking ID parameter for analytics (pick an arbitrary one, or generate a random one with JS)
- Uses standard HTML anchor tag with Cursor deeplink URL based on the existing implementation

### Content Presentation
- Next.js installation guide converted from Markdown to HTML
- Code blocks with syntax highlighting appearance
- Clear section headers and navigation
- Terminal/command examples properly formatted (do not spend too much time on this)

## Requirements

### Functional Requirements
- Single HTML file that can be opened directly in a browser
- No external dependencies (no Tailwind, React, or CDN resources)
- Installation button must generate proper Cursor deeplink URL
- Sidebar must show multiple navigation items (non-functional links okay)
- Main content must display formatted Next.js installation guide
- Include arbitrary tracking ID in the installation URL
- File must be located at `specifications/demos/nextjs/index.html`

### Non-Functional Requirements

#### Performance
- Page must load instantly (single file, no network requests)
- All styling and scripts inline within the HTML file

#### Security & Permissions
- No authentication required
- No server-side processing
- Safe to distribute and run locally

#### User Experience
- Professional documentation site appearance
- Clear visual hierarchy
- Readable typography and spacing
- Installation button prominently placed but not intrusive

## Design Considerations

### Layout & UI
- Two-column layout with fixed sidebar and scrollable content
- Documentation-style typography (serif or system fonts)
- Code blocks with light gray background
- Installation button with Cursor branding colors
- Clean, minimal design without heavy styling

### State Management
- No complex state required
- Static content with no dynamic updates

## Implementation Considerations

### Technical Architecture
- Pure HTML structure with semantic elements
- Inline CSS using `<style>` tags in head
- Minimal inline JavaScript for mobile menu toggle
- Cursor deeplink URL format: `cursor://anysphere.cursor-deeplink/mcp/install?name={name}&config={base64config}&tracking_id={id}`

**IMPORTANT** ASK THE USER for a base64 config when needed

### Dependencies
- None - completely self-contained HTML file
- No build process required
- No external libraries or frameworks

## Success Criteria

### Core Functionality
- Demo page displays properly formatted documentation
- Installation button generates valid Cursor deeplink
- Tracking ID is included in the installation URL
- Page works without any external resources

### Technical Implementation
- Valid HTML5 markup
- Works in modern browsers (Chrome, Firefox, Safari, Edge)
## Scope Boundaries

### Definitely In Scope
- HTML page with documentation layout
- Sidebar navigation (visual only)
- Next.js installation guide content
- "Install to Cursor" button with deeplink
- Tracking ID parameter in URL
- Inline CSS styling

### Definitely Out of Scope
- Functional sidebar navigation
- Dynamic content loading
- Server-side processing
- User authentication
- Analytics tracking implementation
- Multiple documentation pages
- Search functionality
- Dark mode toggle
- Interactive code examples
- Actual MCP server backend
- mobile responsiveness


## Open Questions & Risks

### Questions Needing Resolution
- What should the tracking ID format be (UUID, custom string, etc.)?
    - ANSWER: a prefixed nanoid like `anon_<nanoid>`
- Should the button use Cursor's official install button SVGs or custom styling?
    - ANSWER: use the install button SVG
- What MCP server name and URL should be used in the demo?
    - ANSWER: The MCP server will be to deliver an interactive walkthrough/installer experience for Next.js and that's what the UI should indicate, so use something that effects that well.

## Next Steps
- Create the HTML file at `specifications/demos/nextjs/index.html`
- view & iterate on it with puppeteeer MCP to ensure it's presentable for th epurposes of a demo
