# Sub-Feature: Walkthrough Analytics & Insights

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature provides customers with comprehensive analytics and insights into how their end-users interact with walkthroughs across their MCP servers. The analytics system enables customers to understand user engagement patterns, identify friction points in their onboarding flows, and measure the business impact of their interactive guides. This supports the core MCPlatform business goals of de-anonymizing users and providing actionable insights into the previously opaque evaluation phase of the sales funnel.

## Business Value

### For MCPlatform Customers
- **User Journey Insights**: Understand where users get stuck or drop off in walkthroughs
- **Content Performance**: Identify which walkthroughs drive the highest engagement and completion rates
- **Cross-Server Comparison**: See how the same walkthrough performs across different server contexts
- **ROI Measurement**: Quantify the impact of walkthroughs on user activation and retention
- **Data-Driven Optimization**: Make informed decisions about content improvements and walkthrough assignments

### Key Metrics Categories
- **Engagement Metrics**: Start rates, completion rates, time spent
- **User Behavior**: Step-by-step progression, drop-off points, resume patterns
- **Content Performance**: Popular vs. underperforming walkthroughs
- **Business Impact**: User retention correlation, support ticket reduction

## Core Components

### 1. Server-Specific Analytics Enhancement
**Location**: Existing MCP Server Analytics tab (`/dashboard/servers/[serverId]` - Analytics tab)

#### New Walkthrough Analytics Card
A dedicated card section showing:
- **Total Assigned Walkthroughs**: Count of enabled walkthroughs on this server
- **Active Users (Last 7 Days)**: Users who interacted with walkthroughs
- **Server Completion Rate**: Percentage of started walkthroughs completed on this server
- **Most Popular Walkthrough**: Top-performing walkthrough on this specific server
- **Quick Actions**: "View All Walkthrough Analytics" link to detailed server analytics

#### Detailed Server Walkthrough Analytics Section
Expandable or separate section showing:
- **Performance by Walkthrough**: Table showing each assigned walkthrough's metrics
- **User Engagement Timeline**: Chart showing walkthrough activity over time
- **Step-Level Analytics**: Drill-down to see where users drop off within walkthroughs
- **Completion Funnel**: Visual representation of user progression through walkthrough steps

### 2. Global Walkthrough Analytics Dashboard
**Location**: New analytics section in main Walkthroughs area (`/dashboard/walkthroughs/analytics`)

#### Overview Cards Section
Key performance indicators displayed as cards:
- **Total Walkthroughs Created**: Organization-wide walkthrough count
- **Total Assignments**: Sum of walkthrough-server assignments across all servers
- **Global Completion Rate**: Average completion rate across all walkthroughs and servers
- **Active Users Across All Walkthroughs**: Unique users engaging with any walkthrough
- **Average Steps Per Walkthrough**: Content complexity metric
- **Most Engaging Content**: Top-performing walkthrough globally

#### Detailed Analytics Table
Comprehensive table with columns:
- **Walkthrough Title**: Clickable for drill-down to detailed walkthrough analytics
- **Assigned Servers**: Count with hover tooltip showing server names
- **Total Started**: Aggregate starts across all assigned servers
- **Total Completed**: Aggregate completions across all assigned servers
- **Average Progress**: Mean step completion percentage
- **Completion Rate**: Percentage of started walkthroughs that were completed
- **Server Performance**: Expandable row showing per-server breakdown
- **Last Activity**: Most recent user interaction timestamp

#### Cross-Server Analytics Views
Detailed comparison features:
- **Server Comparison Table**: How each walkthrough performs on different servers
- **Performance Variations**: Identify context-dependent success patterns
- **User Engagement by Server Context**: Understanding how server environment affects walkthrough success
- **Assignment Optimization Recommendations**: Suggest which walkthroughs work best on which servers

### 3. Individual Walkthrough Analytics
**Location**: Walkthrough detail pages (`/dashboard/walkthroughs/[walkthroughId]`)

#### Performance Overview Section
- **Total Engagement**: Starts, completions, active users
- **Content Effectiveness**: Average time per step, completion patterns
- **Server Assignment Performance**: How this walkthrough performs on each assigned server
- **Version Performance**: If multiple versions exist, compare their effectiveness

#### Step-by-Step Analytics
- **Step Progression Chart**: Visual representation of user flow through steps
- **Drop-off Analysis**: Identify which steps cause users to abandon walkthroughs
- **Time Analytics**: Average time spent on each step
- **Content Optimization Insights**: Suggest improvements based on user behavior

### 4. Real-Time Analytics Updates
- **Live Activity Feed**: Show current walkthrough activity across the organization
- **Progress Notifications**: Real-time updates when users complete walkthroughs
- **Alert System**: Notify when completion rates drop significantly
- **Dashboard Auto-Refresh**: Keep metrics current without manual page refreshes

## Key Metrics Specification

### Engagement Metrics
- **Start Rate**: Percentage of server users who start at least one walkthrough
- **Completion Rate**: Percentage of started walkthroughs that reach the final step
- **Step Completion Rate**: Average percentage of steps completed per walkthrough session
- **Resume Rate**: Percentage of interrupted walkthroughs that are resumed
- **Time to Completion**: Average duration from start to completion
- **Steps Per Session**: Average number of steps completed in a single session

### User Behavior Metrics
- **Active Walkthrough Users**: Unique users who interacted with walkthroughs in the specified time period
- **User Progression Patterns**: Common paths users take through multiple walkthroughs
- **Drop-off Points**: Specific steps where users most commonly abandon walkthroughs
- **Session Duration**: Time spent in walkthrough sessions
- **Return User Rate**: Users who engage with walkthroughs across multiple sessions

### Content Performance Metrics
- **Walkthrough Popularity**: Ranking based on start rates and user engagement
- **Content Effectiveness Score**: Composite metric combining completion rate, time to completion, and user satisfaction
- **Step Effectiveness**: Individual step performance within walkthroughs
- **Assignment Success**: How well walkthroughs perform on different servers

### Business Impact Metrics
- **User Activation Correlation**: Relationship between walkthrough completion and user activation events
- **Support Ticket Reduction**: Decrease in support requests for topics covered by walkthroughs
- **Feature Discovery Rate**: Increased usage of features introduced in walkthroughs
- **Time to First Value**: Impact of walkthroughs on user onboarding speed

## Data Visualization Requirements

### Chart Types and Use Cases
- **Line Charts**: Engagement trends over time, user progression patterns
- **Bar Charts**: Completion rates comparison, walkthrough popularity rankings
- **Funnel Charts**: Step-by-step user progression and drop-off visualization
- **Heat Maps**: Server performance comparison matrix
- **Pie Charts**: User status distribution (not started, in progress, completed)
- **Progress Bars**: Individual user progress, completion rate indicators

### Interactive Elements
- **Drill-down Capabilities**: Click through from overview to detailed metrics
- **Time Range Filters**: Adjust analytics periods (7 days, 30 days, 3 months, etc.)
- **Server Filtering**: Focus analytics on specific servers or server groups
- **Walkthrough Filtering**: Analyze subsets of walkthroughs
- **Export Functionality**: Download analytics data for external analysis

## Technical Implementation

### Data Collection Points
Integration with existing `walkthrough_progress` tracking:
- **Tool Usage Events**: Track when users call walkthrough MCP tools
- **Step Transitions**: Record progression between steps with timestamps
- **Session Management**: Track walkthrough sessions across IDE sessions
- **Completion Events**: Record successful walkthrough completions
- **Abandonment Detection**: Identify when users stop progressing through walkthroughs

### Database Analytics Queries
Leverage the proposed schema structure:
```sql
-- Example: Global completion rate calculation
SELECT 
    w.title,
    COUNT(DISTINCT wp.id) as total_started,
    COUNT(DISTINCT CASE WHEN wp.status = 'completed' THEN wp.id END) as total_completed,
    ROUND(
        COUNT(DISTINCT CASE WHEN wp.status = 'completed' THEN wp.id END) * 100.0 / 
        COUNT(DISTINCT wp.id), 2
    ) as completion_rate
FROM walkthroughs w
LEFT JOIN walkthrough_progress wp ON w.id = wp.walkthrough_id
WHERE w.organization_id = ?
GROUP BY w.id, w.title;
```

### Real-Time Data Processing
- **Event Streaming**: Process walkthrough events in real-time for immediate analytics updates
- **Caching Strategy**: Cache frequently accessed metrics to improve dashboard performance
- **Batch Processing**: Aggregate historical data periodically for trend analysis
- **Data Retention**: Define policies for how long to retain detailed analytics data

### Integration with Existing Infrastructure
- **oRPC Analytics Endpoints**: Create server actions for fetching analytics data
- **Server Component Architecture**: Pass analytics promises to client components following MCPlatform patterns
- **React 19 Patterns**: Use the `use()` hook for unwrapping analytics data promises
- **Organization Scoping**: Ensure all analytics respect organization boundaries

## UI Component Specifications

### Analytics Cards
Reuse existing card patterns with walkthrough-specific metrics:
```typescript
<AnalyticsCard
  title="Walkthrough Engagement"
  metric="87%"
  description="Users who start at least one walkthrough"
  trend={+12}
  trendPeriod="vs last month"
/>
```

### Data Tables
Extend existing DataTable component for analytics:
- **Sortable columns** for all metrics
- **Search functionality** for walkthrough titles
- **Pagination** for large datasets
- **Row expansion** for detailed server breakdowns
- **Export functionality** for data analysis

### Interactive Charts
Leverage charting library (Chart.js/Recharts) with:
- **Responsive design** for mobile compatibility
- **Tooltip interactions** showing detailed metrics
- **Click-through functionality** to drill down into specific data points
- **Time range controls** for adjusting analytics periods

### Analytics Dashboard Layout
```typescript
// Global Analytics Page Structure
<AnalyticsDashboard>
  <OverviewCards />
  <FiltersSection />
  <ChartsSection>
    <EngagementTrendsChart />
    <CompletionRatesChart />
    <ServerPerformanceMatrix />
  </ChartsSection>
  <DetailedAnalyticsTable />
</AnalyticsDashboard>
```

## Security and Privacy Considerations

### Data Privacy
- **User Anonymization**: Ensure end-user PII is not exposed in analytics
- **Aggregation Requirements**: Use aggregated data for analytics to protect individual user privacy
- **Data Access Controls**: Restrict analytics access to authorized organization members
- **Compliance**: Ensure analytics data handling complies with privacy regulations

### Performance Security
- **Query Optimization**: Prevent analytics queries from impacting application performance
- **Rate Limiting**: Implement limits on analytics API calls
- **Data Validation**: Validate all analytics inputs to prevent injection attacks
- **Access Logging**: Log analytics access for security monitoring

## Success Metrics for This Sub-Feature

### Customer Adoption
- **Analytics Usage Rate**: Percentage of customers who regularly view walkthrough analytics
- **Insight Action Rate**: Customers who modify walkthroughs based on analytics insights
- **Dashboard Engagement**: Time spent in analytics sections, frequency of access

### Business Impact
- **Customer Decision Making**: Improved walkthrough optimization based on data
- **Support Reduction**: Decreased support tickets about walkthrough effectiveness
- **Content Quality Improvement**: Higher walkthrough completion rates after analytics-driven optimizations

## Implementation Phases

### Phase 1: Basic Analytics Infrastructure
- Implement analytics data collection in walkthrough progress tracking
- Create basic metrics calculations (completion rates, start rates)
- Add simple analytics cards to server detail pages
- Implement basic global analytics overview page

### Phase 2: Enhanced Analytics UI
- Build comprehensive analytics dashboard with charts and tables
- Add detailed walkthrough performance views
- Implement cross-server comparison features
- Create real-time analytics updates

### Phase 3: Advanced Analytics Features
- Add predictive analytics and trend forecasting
- Implement automated insights and recommendations
- Create custom analytics views and reports
- Add export and sharing capabilities for analytics data

## Dependencies

### Internal
- Walkthrough progress tracking system (from core infrastructure sub-feature)
- Existing analytics infrastructure and patterns
- Dashboard UI components and patterns
- Organization-scoped data access controls

### External
- Charting library (Chart.js or Recharts)
- Data visualization components
- Export functionality libraries
- Real-time data processing capabilities

## Related Documents
- [UI Ideation](../thoughts/ui-ideation.md) - Analytics UI specifications and component details
- [Technical Specification](../thoughts/technical-specification.md) - Database schema and implementation patterns
- [Main Feature Document](../feature.md) - Overall context and success metrics
