# Requirements for Better Session Support in the MCPlatform Dashboard

## Goal: 
The goal of this feature is to provide a better user interface for exploring user sessions in the MCPlatform user interface

## Important Context:
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, 
and are exported under `packages/database/index.ts`
* Any paths beginning with `artifacts/` are at the top level of the repository and NOT under `packages/`; the `artifacts/` directory is at the SAME LEVEL as the `packages/` directory.

### User List
THe **user list view** is implemented at the path `/dashboard/users` in `src/app/dashboard/users/page.tsx` and the components contained within.

### User Details
The **user details view** is implemented at the path `/dashboard/users/<identifier>` in `src/app/dashboard/users/[identifier]/page.tsx`


### Composition Pattern 
Unless otherwise specified, all user data should be fetched at the top level of the page in the async server component, and passed down the component tree as promises where they can be `used()`'ed with `<Suspense>` and `<ErrorBoundary>`. 

Promises should **never** be created in a client component unless through a memo, since re-renders will result in the promise never resolving. Promises should **only** be created in the top-level async server component and then passed down all the way to the client components. Only the bottom-level client component that needs a promise should `use()` it. if there are components between the top-level async page, and the component where the promise should be waited for with `use()`, the promise does not need to go inside a `use()` in those components - only where it's actually needed. This will prevent components from suspending unnecessarily. 

### Data Model
information about the data model necessary to implement this feature can be found in `artifacts/01-better-session-support/schema-relationships-and-implementation.md` or accessed directly from the database package at `packages/database/src/*.ts`

## User Stories
This section defines the user stories for the feature.

1. when I navigate to the user details page for a user, I want to see a three-pane user interface for viewing the user's sessions, with a list of all the user's sessions displayed in the left pane, and placeholders in the right and center pane (maybe do this by having the memo to load the tool calls for the session intitially resolve to null to indicate a placeholder should be displayed? )
2. When I select a session, I want to see a loading indicator while the oRPC query is running to fetch the list of tool calls and support tickets, and when it finishes I want to see the list of tool calls and suppor ttickets in sorted order for the selected session in the center pane
3. when I select a tool call or support ticket in the center pane, I want to see the deatils for the tool call / support ticket in the far-right pane. 
4. I want the state of the selected support session and of the tool call / support ticket (if selected) reflected in the URL via shallow updates, so that I can share the link with other users in my organization. 
5. when the page first loads, these parameters should be checked and used to set the state values as appropriate so that the link is effectively shareable with other authenticated & authorized users. 

## Requirements
The **user details view** should have a three-pane user interfaec that uses the following approach: 
1. **left column**: list of user sessions. This should be a list of all the user's sessions; and can be fetched in the top-level page component. It should be rendered with the page. No session should be selected by default. Selecting a session or changing the selected session should update a state variable, which also updates a query parameter (consider using `nuqs` or `nextUseQueryState()` for this so that state is in the URL and manageable. ) Cards in this column should contain basic information about the session, and should be sorted by recency.
2. **center column**: list of tool calls in the session. Until a session is selected from the left column, it should be empty with a nice placeholder. When a session is selected, an ORPC call should be used to fetch the list of tool calls for that session. This can be done with a `useMemo()` that returns a promise, which is run any time the selected session state variable is changed. that promise memo should be passed as a prop to the client componet for the center column, which uses suspense and errorboundary and `use()` to suspend while the promise is pending. Once the promise for the ORPC call is resolved, the list of tool calls for the session should be displayed in the center column. 
3. **right column**: information about the tool call. Once a tool call is selected, the information about that tool call (loaded in the oRPC query for the center column; we should get all the information about each tool call when we fetch the list of tool calls for the session). the input and output information as JSON should be displayed in a nice, easily-readable manner with proper indents and newlines. make sure to display all other tool clal information nicely. 
4. **support ticktes**: as part of the center column, we should also show support tickets that were created during the session, in the proper order with the tool calls based on time stamping (note that the support tickets should have the server session ID property on them.)

### Design considerations:
1. cards in each pane should be compact; with minimal padding or margins; though make sure to include spacing between cards. 
2. the three-pane interface should be responsible across desktop screen sizes, though mobile is not needed. Start with a three-column appproach for wide screens, then narrow to a 2 columns on top and one double-wide one on bottom, and then move to a three vertical panes approach for narrow screens.
3. use shadcn/ui and tailwind; consider using the resizable component for columns. 


