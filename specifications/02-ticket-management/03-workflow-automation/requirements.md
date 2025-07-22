# Phase 3 Requirements: Workflow Automation & Templates

## Goal
Implement advanced workflow features including ticket templates, automation rules, SLA tracking, and custom fields to streamline support processes and improve consistency.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Prerequisites
This phase builds upon Phase 1 (Core Management) and Phase 2 (Enhanced UI) and assumes full activity tracking, bulk operations, and advanced filtering are already implemented.

## User Stories

1. **Ticket Templates**: When creating responses to common issues, I want to use pre-defined templates to ensure consistent, professional responses and reduce response time.

2. **Workflow Automation**: When tickets meet certain criteria, I want automatic actions to be triggered (e.g., auto-assign high priority tickets, escalate overdue tickets) to maintain SLA compliance.

3. **SLA Tracking**: When managing tickets, I want to see visual indicators for SLA status (response time, resolution time) and get alerts when SLAs are at risk.

4. **Custom Fields**: For my organization's specific needs, I want to add custom fields to tickets (e.g., customer type, product version, bug severity) to better categorize and track issues.

5. **Escalation Rules**: When tickets are not resolved within specified timeframes, I want automatic escalation to managers or different teams.

6. **Reporting & Analytics**: I want to view reports on ticket volume, resolution times, common issues, and team performance to identify trends and improvement opportunities.

## Requirements

### Database Schema Extensions

#### Templates System
1. **New Table**: `ticket_templates`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `name`: Template name
   - `category`: Template category (response, resolution, etc.)
   - `title`: Default ticket title template
   - `content`: Template content (markdown with placeholders)
   - `isActive`: Boolean
   - `createdBy`: User who created template
   - `createdAt`: Timestamp

#### Workflow Automation
2. **New Table**: `workflow_rules`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `name`: Rule name
   - `isActive`: Boolean
   - `triggerConditions`: JSONB (conditions that trigger the rule)
   - `actions`: JSONB (actions to perform)
   - `createdBy`: User who created rule
   - `createdAt`: Timestamp

3. **New Table**: `workflow_executions`
   - `id`: Primary key
   - `workflowRuleId`: Foreign key to workflow_rules
   - `supportRequestId`: Foreign key to support_requests
   - `executedAt`: Timestamp
   - `status`: Execution status
   - `result`: JSONB (execution results)

#### SLA & Custom Fields
4. **New Table**: `sla_policies`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `name`: Policy name
   - `priority`: Ticket priority this applies to
   - `responseTimeHours`: Hours for first response
   - `resolutionTimeHours`: Hours for resolution
   - `isActive`: Boolean

5. **New Table**: `custom_fields`
   - `id`: Primary key
   - `organizationId`: Foreign key to organization
   - `name`: Field name
   - `fieldType`: Enum (text, select, multiselect, number, date, boolean)
   - `options`: JSONB (for select/multiselect fields)
   - `isRequired`: Boolean
   - `sortOrder`: Display order

6. **New Table**: `ticket_custom_field_values`
   - `id`: Primary key
   - `supportRequestId`: Foreign key to support_requests
   - `customFieldId`: Foreign key to custom_fields
   - `value`: Text value
   - `createdAt`: Timestamp

#### SLA Tracking
7. **Updated Table**: `support_requests`
   - Add `slaResponseDue`: Timestamp when first response is due
   - Add `slaResolutionDue`: Timestamp when resolution is due
   - Add `firstResponseAt`: Timestamp of first response
   - Add `slaStatus`: Enum (within_sla, at_risk, breached)

### Backend Features

#### Template Management
1. **Template CRUD Operations**: Create, read, update, delete templates
2. **Template Variables**: Support for placeholders ({{user.name}}, {{ticket.id}}, etc.)
3. **Template Categories**: Organize templates by type/category
4. **Template Usage Tracking**: Track how often templates are used

#### Workflow Engine
1. **Rule Engine**: Evaluate trigger conditions against ticket changes
2. **Action Executor**: Perform automated actions (assign, comment, status change, etc.)
3. **Execution Logging**: Track all workflow executions for debugging
4. **Rule Testing**: Dry-run capability to test rules before activation

#### SLA Management
1. **SLA Calculator**: Calculate due dates based on business hours/calendar
2. **SLA Monitor**: Background job to update SLA status
3. **Alert System**: Notifications for SLA risks and breaches
4. **SLA Reporting**: Generate SLA compliance reports

### Frontend Components

#### Template Interface
1. **TemplateManager**: CRUD interface for managing templates
2. **TemplateSelector**: Quick template selection in comment/response forms
3. **TemplateEditor**: Rich editor with variable insertion and preview
4. **TemplateLibrary**: Browse and search templates by category

#### Workflow Management
1. **WorkflowRuleBuilder**: Visual rule builder interface
2. **WorkflowRuleList**: Manage and monitor workflow rules
3. **WorkflowExecutionLog**: View execution history and debug issues
4. **RuleTestRunner**: Test rules against sample data

#### SLA & Custom Fields
1. **SLAIndicator**: Visual SLA status indicators on tickets
2. **SLADashboard**: Overview of SLA performance
3. **CustomFieldsManager**: Configure custom fields for organization
4. **CustomFieldsRenderer**: Display custom fields in ticket interface

### Automation Rules Examples

#### Common Trigger Conditions
- Ticket created with specific criteria
- Status changed to specific value
- Priority set to high/critical
- Ticket unassigned for X hours
- No response for X hours
- Custom field matches criteria

#### Common Actions
- Auto-assign to specific user/team
- Change status or priority
- Add automated comment
- Set due dates
- Send email notifications
- Create follow-up tasks
- Escalate to manager

### Design Considerations

#### Template System
1. **Variable Substitution**: Rich placeholder system with ticket/user/org context
2. **Template Versioning**: Track template changes over time
3. **Template Categories**: Logical organization (responses, resolutions, escalations)
4. **Preview System**: Live preview of templates with sample data

#### Workflow Automation
1. **Visual Rule Builder**: Drag-and-drop interface for non-technical users
2. **Rule Priority**: Handle conflicts when multiple rules match
3. **Rate Limiting**: Prevent workflow loops and spam
4. **Audit Trail**: Complete logging of automated actions

#### SLA Management
1. **Business Hours**: Support for organization-specific business calendars
2. **SLA Escalation**: Visual and notification-based escalation paths
3. **Exception Handling**: Ability to pause SLA for valid reasons
4. **Historical Tracking**: Maintain SLA performance history

### Performance Considerations
1. **Background Processing**: Workflow execution via job queue
2. **Rule Optimization**: Efficient rule evaluation algorithms
3. **SLA Calculation**: Optimized business hours calculations
4. **Custom Field Indexing**: Proper indexing for custom field queries

## Success Criteria
- Templates significantly reduce response time for common issues
- Workflow automation handles routine tasks without manual intervention
- SLA tracking provides clear visibility into performance and compliance
- Custom fields allow organizations to track their specific data requirements
- Automation rules work reliably without creating loops or conflicts
- System performance remains good despite added complexity
- Users can easily configure and manage automated workflows without technical expertise