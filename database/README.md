# Database Setup for Analytics and Consent Tracking

This directory contains the database schema for analytics events and consent tracking features.

## Setup Instructions

1. **Access your Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Create the Consents Table**
   - Copy the contents of `consents_table.sql`
   - Paste it into the SQL Editor
   - Execute the query

3. **Create the Events Table**
   - Copy the contents of `events_table.sql`
   - Paste it into the SQL Editor
   - Execute the query

4. **Create the Web Vitals Table**
   - Copy the contents of `web_vitals_table.sql`
   - Paste it into the SQL Editor
   - Execute the query

5. **Verify the Tables**
   - Go to the Table Editor in your Supabase dashboard
   - You should see three new tables:
   
   **consents table:**
   - `id` (UUID, Primary Key)
   - `session_id` (Text)
   - `variant` (Text, either 'A' or 'B')
   - `decision` (Text, either 'accept' or 'decline')
   - `ms_to_decision` (Integer)
   - `meta` (JSONB, additional metadata)
   - `created_at` (Timestamp)
   
       **events table:**
    - `id` (UUID, Primary Key)
    - `session_id` (Text)
    - `route` (Text)
    - `name` (Text)
    - `props` (JSONB)
    - `created_at` (Timestamp)
    
    **web_vitals table:**
    - `id` (UUID, Primary Key)
    - `session_id` (Text)
    - `route` (Text)
    - `metric` (Text: 'CLS', 'FCP', 'LCP', 'TTFB', 'INP')
    - `value` (Decimal)
    - `nav_type` (Text)
    - `device_mem` (Decimal, optional)
    - `hardware_concurrency` (Integer, optional)
    - `effective_connection_type` (Text, optional)
    - `created_at` (Timestamp)

## Table Schema Details

### Consents Table
- **session_id**: Unique identifier for each user session (UUID v4)
- **variant**: A/B test variant shown to the user ('A' or 'B')
- **decision**: User's choice ('accept' or 'decline')
- **ms_to_decision**: Time in milliseconds from modal opening to user decision
- **meta**: Additional metadata (e.g., source context, user agent info)
- **created_at**: Timestamp when the record was created

### Events Table
- **session_id**: Unique identifier for each user session
- **route**: Current page route (e.g., '/results', '/')
- **name**: Event name (e.g., 'results_view', 'feedback_open', 'scroll_depth')
- **props**: Additional event properties as JSON
- **created_at**: Timestamp when the event occurred

### Web Vitals Table
- **session_id**: Unique identifier for each user session
- **route**: Current page route where the metric was measured
- **metric**: Core Web Vital metric name (CLS, FCP, LCP, TTFB, INP)
- **value**: Numeric value of the metric
- **nav_type**: Navigation type (navigate, reload, back_forward, prerender)
- **device_mem**: Device memory in GB (if available)
- **hardware_concurrency**: Number of CPU cores (if available)
- **effective_connection_type**: Network connection type (slow-2g, 2g, 3g, 4g)
- **created_at**: Timestamp when the metric was recorded

## Security

The table has Row Level Security (RLS) enabled with policies that:
- Allow inserts from any user (for consent tracking)
- Only allow reads from authenticated users (to protect privacy)

## Usage

The frontend will automatically insert data when users interact with the application:

- **Consent data**: Inserted when users interact with the pre-results consent modal
- **Event data**: Inserted for page views, scroll depth, feedback interactions, and other user actions
- **Web vitals data**: Inserted once per route for Core Web Vitals metrics (LCP, INP, CLS, FCP, TTFB)

No additional configuration is needed once the tables are created.
