# AGENTS.md - MCPlatform Comprehensive Development Guide

## 1. Project Overview & Core Business Logic

MCPlatform is a multi-tenant SaaS application built with a modern tech stack: **Next.js 15 (App Router)**, **Drizzle ORM**, **Better Auth**, **oRPC**, and **Bun**.

The platform's primary purpose is to allow our customers (e.g., developer tools companies) to create and manage **MCP (Model Context Protocol) servers**. These servers can be embedded directly into their documentation sites, providing AI-powered assistance to their end-users within their development environments.

This achieves two main business goals:

1.  **De-anonymization & User Insight**: By tracking interactions through unique IDs or identifying users via an OAuth flow, we provide our customers with unprecedented visibility into the previously opaque evaluation phase of their sales funnel. They can understand user pain points, see what questions are being asked, and identify friction.
2.  **Enhanced Engagement & Activation**: The platform is a direct channel into an end-user's editor, allowing our customers to deliver interactive courses, tutorials, and proactive support, thereby improving user onboarding and activation.

## 2. Core Architectural Concepts

### VHost-Based Routing for MCP Servers

A critical piece of the architecture is how incoming requests are routed to the correct MCP server. This is **not** done via path-based routing but through the request's `Host` header.

1.  When a customer creates an MCP server, they assign it a unique `slug` (e.g., `acme-corp`).
2.  This `slug` is used to create a subdomain (e.g., `acme-corp.mcplatform.com`).
3.  When a request arrives at `/api/mcpserver/...`, the `getMcpServerConfiguration` function (in `packages/dashboard/src/lib/mcp/index.ts`) inspects the `Host` header.
4.  It extracts the subdomain part of the host and uses it to query the `mcp_servers` table for a matching `slug`.
5.  This lookup retrieves the correct server configuration, allowing a single API route to serve countless different MCP servers dynamically.

### The Dual Authentication System

The application uses **two distinct and parallel authentication systems**. Understanding the separation is crucial.

#### A. Platform Authentication (For Our Customers)

*   **Purpose**: To provide access to the main dashboard where our customers manage their organizations, create MCP servers, and view analytics.
*   **Schema**: Defined in `packages/database/src/auth-schema.ts`. This includes tables like `user`, `session`, and `organization`.
*   **Implementation**: Managed by the primary `betterAuth` instance in `packages/dashboard/src/lib/auth/auth.ts`. It's configured with plugins for multi-tenancy (`organization`) and standard login methods (email/password, Google, GitHub).
*   **Users**: These are the paying customers who should have access to the application's core features.

#### B. Sub-tenant Authentication (For End-Users)

*   **Purpose**: To identify and authorize the *end-users* of our customers' products when they interact with an MCP server. Its sole function is to de-anonymize the user by capturing their email via an OAuth flow.
*   **Schema**: Defined in `packages/database/src/mcp-auth-schema.ts`. This includes a parallel set of tables like `mcp_oauth_user`, `mcp_oauth_session`, and `mcp_oauth_application`.
*   **Implementation**: Managed by a *separate, secondary* `betterAuth` instance in `packages/dashboard/src/lib/auth/mcp/auth.ts`. This instance is specifically configured with the `mcp` plugin and has its own login page (`/mcp-oidc/login`).
*   **Users**: These users **NEVER** get access to the dashboard. They are simply being identified. This system ensures a clean separation between our customers and their users.

## 3. Database Primitives & Schema

The database schema is managed with Drizzle ORM.

*   **`organization`**: Stores customer organizations (tenants).
*   **`user`, `session`, `account`**: Manages platform (dashboard) user authentication.
*   **`mcp_servers`**: The core table storing MCP server configurations. The `slug` column is key for the vhost routing.
*   **`mcp_oauth_application`, `mcp_oauth_user`, `mcp_oauth_session`**: Manages the sub-tenant (end-user) OAuth configurations and user data.
*   **`support_requests`**: Stores support tickets submitted by end-users.
*   **Schema Patterns**:
    *   **IDs**: Use `text` with `nanoid` for generation.
    *   **Timestamps**: Use `bigint` for `created_at`, not the native `timestamp` type.

## 4. Development Workflow & Commands

*   **Package Manager**: This project uses **Bun**. Never use `npm`, `yarn`, or `pnpm`.
*   **Installation**: `bun install`
*   **Run Dashboard Dev Server**: `cd packages/dashboard && bun run dev`. The server is always available on `http://localhost:3000`.
*   **Lint & Format**: The project uses **Biome**. Run `bunx @biomejs/biome check .` to lint and format.
*   **Testing**:
    *   Run all tests: `bun test`
    *   Run a single test file: `bun test <path_to_file>`
    *   Run tests by name: `bun test --grep "test description"`
*   **Database Migrations**:
    *   Generate: `cd packages/database && bun run db:generate`
    *   Run: `cd packages/database && bun run db:migrate`

## 5. Code Style & Architectural Patterns

### Formatting & Naming
*   **Formatting**: 4-space indentation, 120-char line width, single quotes. See `biome.jsonc`.
*   **File Naming**: `kebab-case.tsx` for components; `page.tsx`/`layout.tsx` for routes.
*   **Imports**: Grouped: 1. External libs, 2. Internal aliases (`@/`), 3. Relative paths.

### Critical Architecture: Server & Client Components
1.  **Pages (`page.tsx`) are Async Server Components**:
    *   They are `async function` and perform server-side logic (`requireSession()`, data fetching).
    *   **They must pass promises for data to client components**, not resolved data.
    *   They must wrap client components in `<Suspense>` and `<ErrorBoundary>`.

2.  **UI Components are Client Components**:
    *   Must start with `'use client'`.
    *   Receive data as promises and use the React 19 `use()` hook to unwrap them.

### Server Actions (oRPC)
*   All data mutations must be handled by server actions defined with oRPC in `packages/dashboard/src/lib/orpc/actions.ts`.
*   Actions must be wrapped with `.actionable({})`.
*   After a successful mutation, **must** call `revalidatePath('/path-to-revalidate')`.

## 6. Critical Rules & Gotchas

*   **NEVER run database migrations** without explicit permission from the user.
*   The dev server is always running on port 3000. Use **Puppeteer** to check UI changes.
*   **Authentication logic belongs on the server**. Never perform auth checks in client components.
*   Use **`shadcn/ui`** components for all UI. Do not use Radix UI primitives directly.
*   When writing data, use server actions via oRPC. When reading data, query the database directly in Server Components.