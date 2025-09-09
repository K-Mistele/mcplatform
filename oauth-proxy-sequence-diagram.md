# OAuth Proxy Flow Sequence Diagram

```
title OAuth Flow w/ DCR Proxy - Complete Flow

MCP Client -> MCP Server: POST /mcp (JSON-RPC tool call)

MCP Client <-- MCP Server: HTTP 401/ WWW-Authenticate\n(Bearer resource_metadata=\n/.well-known/oauth-authorization-server)

MCP Client -> MCP Server: GET /.well-known/oauth-authorization-server

MCP Server -> MCP Server: check VHost

MCP Server -> Database: look up MCP server & oauth config\nbased on MCP server slug in VHOST

MCP Server <-- Database: MCP Server & OAuth config\n(MCP server uses 'Custom OAuth' config)

MCP Server -> MCP Server: Create authorization server metadata for a "custom oauth" config\n which specifies the endpoints that we use for a proxied\n upstream authorization server

MCP Client <-- MCP Server: return authorization server metadata which points\n to endpoints **on the MCP Server**\n(not the upstream authorization server)

note over MCP Client: MCP Client performs dynamic client registration

MCP Client -> MCP Server: POST /oauth/register\n(redirect_uris, client metadata)

MCP Server -> MCP Server: VHost lookup → MCP server → custom OAuth config

MCP Server -> Database: Store client registration\n(mcp_client_registrations table)

MCP Server <-- Database: Registration stored

MCP Client <-- MCP Server: Return proxy client_id/secret\n(NOT upstream credentials)

note over MCP Client: MCP Client initiates authorization flow

MCP Client -> User Browser: Redirect to /oauth/authorize?client_id=<proxy_client_id>&redirect_uri=<mcp_redirect>

User Browser -> MCP Server: GET /oauth/authorize

MCP Server -> MCP Server: VHost lookup → MCP server → custom OAuth config

MCP Server -> Database: Validate proxy client_id against registrations

MCP Server <-- Database: Client registration validated

MCP Server -> MCP Server: Generate OAuth state parameter

User Browser <-- MCP Server: Redirect to upstream OAuth server\n/authorize?client_id=<our_stored_client_id>&redirect_uri=<our_callback>&state=<state>

User Browser -> Upstream OAuth Server: GET /authorize

User -> Upstream OAuth Server: User authorizes application

User Browser <-- Upstream OAuth Server: Redirect to our callback\n/oauth/callback?code=<auth_code>&state=<state>

User Browser -> MCP Server: GET /oauth/callback

MCP Server -> MCP Server: Validate state parameter

MCP Server -> Upstream OAuth Server: POST /token\n(code exchange using our stored client_secret)

MCP Server <-- Upstream OAuth Server: upstream access_token + refresh_token

MCP Server -> Database: Store upstream tokens\n(upstream_oauth_tokens table)

MCP Server <-- Database: Tokens stored

MCP Server -> MCP Server: Generate our own authorization code

User Browser <-- MCP Server: Redirect to MCP client redirect_uri\nwith our authorization code

User Browser -> MCP Client: Authorization code delivered

note over MCP Client: MCP Client exchanges authorization code for access token

MCP Client -> MCP Server: POST /oauth/token\n(our authorization code)

MCP Server -> Database: Validate our authorization code

MCP Server <-- Database: Code validated

MCP Server -> Database: Store proxy access token\n(mcp_proxy_tokens table)

MCP Server <-- Database: Proxy token stored

MCP Client <-- MCP Server: Return proxy access_token\n(never upstream tokens)

note over MCP Client: MCP Client makes authenticated requests

MCP Client -> MCP Server: POST /mcp\nAuthorization: Bearer <proxy_token>

MCP Server -> Database: Validate proxy token

MCP Server <-- Database: Proxy token valid, get upstream token

MCP Server -> Upstream OAuth Server: GET /userinfo\nAuthorization: Bearer <upstream_token>

MCP Server <-- Upstream OAuth Server: User info

MCP Server -> MCP Server: Process MCP request with user context

MCP Client <-- MCP Server: MCP response
```