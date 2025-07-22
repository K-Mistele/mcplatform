# Phase 4 Requirements: External Integrations & Communication

## Goal
Implement external integrations including Linear, Slack, email communication, file attachments, and notification systems to provide a comprehensive support ecosystem.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Prerequisites
This phase builds upon all previous phases and assumes full ticket management, workflow automation, and SLA tracking are already implemented.

## User Stories

1. **Linear Integration**: When managing tickets, I want to create Linear issues directly from support tickets and sync status updates bidirectionally to maintain consistency across tools.

2. **Slack Integration**: When tickets are created or updated, I want notifications sent to relevant Slack channels, and I want to be able to respond to tickets directly from Slack.

3. **Email Communication**: When communicating with users, I want to send and receive emails directly through the ticket interface, with full email thread history maintained within the ticket.

4. **File Attachments**: When investigating issues, I want users and support staff to attach files (screenshots, logs, configs) to tickets for better context and troubleshooting.

5. **Smart Notifications**: I want intelligent notification rules that alert the right people at the right time without creating notification fatigue.

6. **Third-party Webhooks**: For custom integrations, I want to configure webhooks that trigger on ticket events to integrate with other tools in our workflow.

## Requirements

### Database Schema Extensions

#### Integration Management
1. **New Table**: `integration_configs`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `integrationType`: Enum ('linear', 'slack', 'email', 'webhook')
   - `name`: Integration name
   - `isActive`: Boolean
   - `config`: JSONB (integration-specific configuration)
   - `credentials`: JSONB (encrypted credentials)
   - `createdAt`: Timestamp

#### External Sync
2. **New Table**: `external_sync_records`
   - `id`: Primary key
   - `supportRequestId`: Foreign key to support_requests
   - `integrationConfigId`: Foreign key to integration_configs
   - `externalId`: External system ID
   - `externalUrl`: External system URL
   - `syncStatus`: Enum ('synced', 'failed', 'pending')
   - `lastSyncAt`: Timestamp

#### File Attachments
3. **New Table**: `ticket_attachments`
   - `id`: Primary key
   - `supportRequestId`: Foreign key to support_requests
   - `fileName`: Original file name
   - `fileSize`: File size in bytes
   - `mimeType`: File MIME type
   - `storageKey`: Storage system key/path
   - `uploadedBy`: User who uploaded
   - `uploadedAt`: Timestamp

#### Email Communication
4. **New Table**: `ticket_emails`
   - `id`: Primary key
   - `supportRequestId`: Foreign key to support_requests
   - `messageId`: Email message ID
   - `direction`: Enum ('inbound', 'outbound')
   - `fromAddress`: Sender email
   - `toAddresses`: Recipient emails (array)
   - `subject`: Email subject
   - `content`: Email content
   - `sentAt`: Timestamp

#### Notification System
5. **New Table**: `notification_rules`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `name`: Rule name
   - `triggerEvents`: JSONB (events that trigger notifications)
   - `channels`: JSONB (notification channels: email, slack, etc.)
   - `recipients`: JSONB (who gets notified)
   - `isActive`: Boolean

### Backend Features

#### Linear Integration
1. **Linear API Client**: Full Linear GraphQL API integration
2. **Bidirectional Sync**: Sync ticket status, comments, and metadata
3. **Issue Creation**: Automatically create Linear issues from tickets
4. **Status Mapping**: Map ticket statuses to Linear issue states
5. **Comment Sync**: Sync comments bidirectionally

#### Slack Integration
1. **Slack Bot**: Bot for receiving commands and sending notifications
2. **Channel Notifications**: Send ticket updates to designated channels
3. **Direct Message Support**: Handle private ticket discussions
4. **Slash Commands**: `/ticket create`, `/ticket update`, `/ticket assign`
5. **Interactive Messages**: Action buttons for common operations

#### Email System
1. **Email Processing**: Parse inbound emails and link to tickets
2. **Email Templates**: Rich HTML email templates
3. **Thread Management**: Maintain email conversation threads
4. **Auto-reply**: Configurable auto-reply messages
5. **Email Routing**: Route emails to correct tickets based on subject/headers

#### File Management
1. **File Upload**: Secure file upload with validation
2. **Storage Integration**: Support for S3, Azure Blob, etc.
3. **Virus Scanning**: Scan uploaded files for security
4. **Image Processing**: Thumbnail generation for images
5. **Access Control**: Ensure only authorized users can access files

### Frontend Components

#### Integration Management
1. **IntegrationSettings**: Configure and manage integrations
2. **LinearIntegrationSetup**: Linear-specific setup wizard
3. **SlackIntegrationSetup**: Slack workspace connection
4. **EmailIntegrationSetup**: Email configuration interface
5. **WebhookManager**: Configure custom webhooks

#### Communication Interface
1. **EmailComposer**: Rich email composition within ticket interface
2. **EmailThread**: Display email conversation history
3. **SlackNotificationPreview**: Preview how notifications appear in Slack
4. **FileUploadZone**: Drag-and-drop file upload interface
5. **AttachmentGallery**: View and manage ticket attachments

#### External Links
1. **LinearIssueLink**: Display and navigate to linked Linear issues
2. **SlackConversationLink**: Link to relevant Slack conversations
3. **ExternalSyncStatus**: Show sync status with external systems
4. **IntegrationHealthMonitor**: Monitor integration status and errors

### Integration Specifications

#### Linear Integration
- **Authentication**: OAuth 2.0 with Linear
- **Sync Frequency**: Real-time webhooks + periodic sync
- **Data Mapping**:
  - Ticket → Linear Issue
  - Status → Issue State
  - Comments → Issue Comments
  - Assignee → Issue Assignee

#### Slack Integration
- **Authentication**: Slack OAuth with Bot Token
- **Notification Types**:
  - New ticket created
  - Status changes
  - High priority ticket alerts
  - SLA breach warnings
- **Commands**:
  - View ticket details
  - Quick status updates
  - Assign tickets
  - Add comments

#### Email Integration
- **Inbound Processing**: IMAP/webhook processing
- **Outbound Delivery**: SMTP/API sending
- **Threading**: Parse In-Reply-To and References headers
- **Security**: DKIM/SPF validation for inbound emails

### Security & Privacy

#### File Security
1. **Virus Scanning**: All uploads scanned before storage
2. **Access Controls**: Role-based file access permissions
3. **Encryption**: Files encrypted at rest and in transit
4. **Audit Logging**: Track all file access and downloads

#### Integration Security
1. **Credential Management**: Encrypted storage of API keys/tokens
2. **OAuth Flow**: Secure OAuth implementation for integrations
3. **Rate Limiting**: Respect external API rate limits
4. **Error Handling**: Graceful handling of integration failures

### Performance Considerations
1. **Async Processing**: Background jobs for external API calls
2. **Rate Limiting**: Intelligent rate limiting for external APIs
3. **Caching**: Cache external data appropriately
4. **File Optimization**: Efficient file storage and retrieval
5. **Webhook Queuing**: Queue and batch webhook deliveries

## Success Criteria
- Linear integration maintains bidirectional sync without conflicts
- Slack notifications are timely and actionable
- Email communication flows seamlessly within ticket interface
- File attachments upload and display quickly and securely
- Integrations remain stable and handle failures gracefully
- External sync provides clear visibility into connection status
- Performance impact of integrations is minimal on core functionality
- All integrations respect security and privacy requirements