-- Claude Code Activity Dashboard - Dynamic Tables (Mart Layer)

USE SCHEMA <DB>.CLAUDE_CODE;

-- ユーザー×日別集計
CREATE OR REPLACE DYNAMIC TABLE USER_DAILY
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  COMMENT = 'ユーザー別日次集計'
AS
SELECT
  DATE_TRUNC('day', r.occurred_at)  AS dt,
  r.user_email,
  r.user_name,
  COUNT(DISTINCT r.session_id)      AS sessions,
  COUNT(*)                          AS total_events,
  SUM(CASE WHEN r.event_type = 'skill'         THEN 1 ELSE 0 END) AS skill_count,
  SUM(CASE WHEN r.event_type = 'sub_agent'     THEN 1 ELSE 0 END) AS sub_agent_count,
  SUM(CASE WHEN r.event_type = 'mcp'           THEN 1 ELSE 0 END) AS mcp_count,
  SUM(CASE WHEN r.event_type = 'slash_command' THEN 1 ELSE 0 END) AS slash_command_count,
  SUM(r.input_tokens)               AS input_tokens,
  SUM(r.output_tokens)              AS output_tokens,
  SUM(r.cache_read_tokens)          AS cache_read_tokens,
  SUM(r.cache_write_tokens)         AS cache_write_tokens,
  SUM(
    r.input_tokens        * COALESCE(m.input_cost_per_1k,  0) / 1000.0
    + r.output_tokens     * COALESCE(m.output_cost_per_1k, 0) / 1000.0
    + r.cache_read_tokens * COALESCE(m.cache_read_per_1k,  0) / 1000.0
    + r.cache_write_tokens* COALESCE(m.cache_write_per_1k, 0) / 1000.0
  ) AS cost_usd
FROM EVENTS_RAW r
LEFT JOIN MODEL_PRICING m ON r.model = m.model
GROUP BY 1, 2, 3;


-- ツール別利用集計
CREATE OR REPLACE DYNAMIC TABLE TOOL_DAILY
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  COMMENT = 'ツール（スキル・MCP・サブエージェント）別日次集計'
AS
SELECT
  DATE_TRUNC('day', occurred_at) AS dt,
  event_type,
  event_name,
  COUNT(DISTINCT user_email)     AS unique_users,
  COUNT(*)                       AS usage_count
FROM EVENTS_RAW
WHERE event_name IS NOT NULL
GROUP BY 1, 2, 3;


-- ワークスペース別集計
CREATE OR REPLACE DYNAMIC TABLE WORKSPACE_DAILY
  TARGET_LAG = '1 hour'
  WAREHOUSE = COMPUTE_WH
  COMMENT = 'リポジトリ別日次集計'
AS
SELECT
  DATE_TRUNC('day', occurred_at) AS dt,
  workspace,
  COUNT(DISTINCT user_email)     AS unique_users,
  COUNT(DISTINCT session_id)     AS sessions,
  COUNT(*)                       AS total_events
FROM EVENTS_RAW
GROUP BY 1, 2;
