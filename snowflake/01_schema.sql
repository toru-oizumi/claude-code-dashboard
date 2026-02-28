-- Claude Code Activity Dashboard - Snowflake Schema
-- DB名は実際の環境に合わせて変更してください（<DB> を置換）
-- 例: USE DATABASE ANALYTICS;

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS <DB>.CLAUDE_CODE
  COMMENT = 'Claude Code活用状況データ';

USE SCHEMA <DB>.CLAUDE_CODE;
