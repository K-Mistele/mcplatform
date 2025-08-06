---
date: 2025-08-05T21:36:26-07:00
researcher: Kyle
git_commit: 723ada7d4beef4e5a49db78c7d6797620fcd5b6d
branch: master
repository: mcplatform
topic: "Comprehensive Analytics Vision for Walkthrough Platform"
tags: [thoughts, analytics, walkthrough, ui-design, metrics, sankey-charts, meta-analytics]
status: draft
last_updated: 2025-08-05
last_updated_by: Kyle
type: thoughts
---

# Comprehensive Analytics Vision for Walkthrough Platform

## Key Insights

1. **Current Dashboard Issues**: MCP activity chart tooltips showing "invalid date" - needs fixing
2. **Tag Normalization**: Convert technical tags to human-readable labels (users → Active Users, get_support → Support Ticket Created, etc.)
3. **Global Time Period Controls**: Move time selection out of individual cards to page-level for consistent data filtering
4. **Individual MCP Server Analytics**: Need dedicated analytics view per MCP server
5. **Walkthrough-Specific Analytics**: Detailed funnel analysis with Sankey charts showing progression
6. **Meta Analytics**: Cross-walkthrough comparison and analysis
7. **AI-Powered Insights**: LLM-generated recommendations based on analytics data

## Primary Interface Requirements

### 1. Enhanced Dashboard Layout
- **Global Time Period Selector**: Move from MCP activity card to page header
- **Unified Data Refresh**: All cards (MCP tool calls, support tickets, active users) update based on selected time period
- **Normalized Labels**: Human-readable names for all metrics

### 2. MCP Server Analytics View
**Location**: New page/tab within MCP server management
**Content**:
- Active users over time
- Tool call interactions
- Similar charts to main dashboard but server-specific

### 3. Individual Walkthrough Analytics Interface
**Location**: New "Stats" tab within walkthrough editor (alongside Editor, Settings)
**Key Components**:

#### Sankey Chart - User Journey Flow
- **Entry Point**: MCP server installation/connection
- **Authorization**: User de-anonymization via OAuth
- **Step Progression**: Each walkthrough step completion
- **Support Events**: Support ticket creation points
- **Documentation Queries**: Search interactions (future feature)
- **Completion**: Final step reached

#### Detailed Metrics Panels
- **Completion Rates**: Percentage reaching each step
- **Time Analytics**: Average completion time per step
- **Drop-off Analysis**: Where users exit most frequently
- **Support Correlation**: Which steps generate most support tickets
- **Performance Indicators**: Steps taking longest to complete

### 4. Meta Analytics Dashboard
**Location**: New top-level analytics section
**Views**:

#### Cross-Walkthrough Comparison
- **Completion Rate Chart**: Bar chart showing percentage completion per walkthrough with error bars/standard deviation
- **Step Penetration**: Average progress depth across walkthroughs
- **Support Ticket Analysis**: Tickets generated per walkthrough for selected time period
- **Documentation Query Clustering**: Where searches concentrate (future)
- **Session Initiation Rates**: Walkthrough start rates comparison

#### Comparative Analysis Tools
- **Multi-select Interface**: Choose specific walkthroughs to compare
- **Side-by-side Statistics**: Parallel metrics display
- **Trend Analysis**: Performance over time for multiple walkthroughs

### 5. AI-Powered Insights Panel
**Implementation**: Background job with periodic analysis
**Features**:
- **Automated Recommendations**: Top improvements based on data analysis
- **Content Correlation**: Link walkthrough content to user behavior patterns
- **Question Analysis**: Process support ticket content for common issues
- **Notification System**: Proactive alerts for significant changes or opportunities
- **Insight Scheduling**: Regular reports with actionable recommendations

## Technical Implementation Considerations

### Data Requirements
- Enhanced event tracking for step progression
- Support ticket correlation with walkthrough steps
- Documentation query logging (future)
- Session timing and duration tracking
- User journey state management

### Interface Architecture
- RSC-based revalidation for time period changes
- Real-time updates for active analytics
- Efficient data aggregation for meta analytics
- Sankey chart component implementation
- Interactive filtering and drill-down capabilities

### Background Processing
- Scheduled analytics jobs for insight generation
- LLM integration for automated analysis
- Notification system for insights delivery
- Data warehousing for historical trend analysis

## Raw Transcript:
Okay, so I have a bunch of thoughts about analytics for the platform and how we want to display this user interface. First of all, the MCP activity chart area on the dashboard. The tooltip says invalid date all the time, which like sucks and shouldn't happen. Second, the tags are like users and get support and get next step and start walkthrough. We should probably normalize these to human readable things like active users and support ticket created and user progressed in course and or excuse me, user progressed and walkthrough and walkthrough started. We also right now show MCP tool calls, support tickets and active users as well as quick actions. I'm wondering if we should move the tabs for time period selection out of the MCP activity card and like to the top of the page so that all of the data is based on the current time and then we can like revalidate the page with RSC and refetch like support tickets and active users and stuff based on the selected time period. That feels like it would be better. Other things that we care a lot about being able to do, I want to be able to look at an MCP server and the charts for you know, for that MCP server, the number of active users, you know, kind of like on the dashboard and number of interactions. Like that would be really cool. I want to go to a walkthrough and this is where we care a lot about walkthroughs, right? Is I want to be able to go to a walkthrough and we'll probably need a better like interface than we have right now because we have the editor, we have settings, probably we'll need stats, right? Because like what I really want to be able to do is show like a Sankey chart of okay, how many people started the course and then from, you know, like installed the MCP server, right? IE there was a connection. How many people then authorized and were de-anonymized? How many people then took the first step of that? How many people then proceeded to the next one and to the next one? And by the way, like as people were in those sessions, like where, you know, at which steps like were we creating support tickets, right? Like can we include support ticket created in the Sankey chart? Can we include like documentation query search once we add that, although we don't have that MCP tool yet, but we will for documentation retrieval, right? And then I want to know like what's happening, how many users are reaching the end? How what percentage of users make it to each step? How long on average does each step take to complete? Like which steps have the most, you know, which steps have the most like support tickets or fall off or, or, you know, take the longest to complete and like being able to display all of that information nicely would be great. And then by the way, I also want meta analytics. I want to be able to like figure out what some of those things look like for all of my different walkthroughs or to compare walkthroughs. I want to see like how many people, you know, are starting each walkthrough, how many people are finishing each walkthrough? What is the average progress for it with like error bars or, or, you know, a standard deviation, right? So I want to see like the line of okay, for each or like chart bar chart or something for each of the walkthroughs, you know, on the y-axis, this is the percentage of people that, you know, complete it. And then like, what is the standard deviation on that? And then maybe like, I want to know, be able to break that down into steps and how far are people getting in, you know, into each walkthrough on average with like a standard deviation, right? Which like out of all the walkthroughs, I want to see side by side, you know, how many support tickets were created for the given time period for each of the walkthroughs? How many, you know, documentation queries were done? How many sessions were initiated? Right? And all of this meta analysis about the walkthroughs and support tickets and documentation, I'm like, how those things relate to each other? Like I really want to be able to like get at what are people doing, which things out of all these different walkthroughs are people most interested in? Where are documentation queries clustering? And then like also, can we do LLM powered analytics, right? We can like kind of feed some of this data into an LLM and say like, Hey, what are like the top improvements that I should make based on these are the top, you know, this is all the information about the walkthrough in terms of where people are making it. Here's all the content for it. Here's the questions people are asking, like, can we automatically generate insights? Like here's what you need to improve. And probably we can schedule that with like an ingest background job and kind of generate insights periodically and send you notifications and shit. But like that would all be really good stuff to have and to have like a very detailed, robust analytics view where you can pick one walkthrough or multiple walkthroughs and view all those statistics and senki charts and meta analyses of those. That would be really, really awesome.