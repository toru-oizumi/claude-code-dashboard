-- Claude Code Activity Dashboard - Raw Events Table

USE SCHEMA <DB>.CLAUDE_CODE;

CREATE TABLE IF NOT EXISTS EVENTS_RAW (
  -- 識別
  event_id            STRING        NOT NULL DEFAULT UUID_STRING(),
  session_id          STRING        NOT NULL,
  message_id          STRING,

  -- ユーザー・環境
  user_email          STRING        NOT NULL,
  user_name           STRING,
  hostname            STRING,
  cwd                 STRING,
  workspace           STRING,

  -- イベント種別
  event_type          STRING        NOT NULL,  -- skill|sub_agent|mcp|slash_command|message
  event_name          STRING,
  event_detail        VARIANT,                 -- tool inputの生JSON（将来の分析用）

  -- モデル・トークン
  model               STRING,
  input_tokens        NUMBER        DEFAULT 0,
  output_tokens       NUMBER        DEFAULT 0,
  cache_read_tokens   NUMBER        DEFAULT 0,
  cache_write_tokens  NUMBER        DEFAULT 0,

  -- 時刻
  occurred_at         TIMESTAMP_TZ  NOT NULL,
  ingested_at         TIMESTAMP_TZ  NOT NULL DEFAULT CURRENT_TIMESTAMP(),

  -- 制約
  CONSTRAINT pk_events_raw PRIMARY KEY (event_id),
  CONSTRAINT chk_event_type CHECK (
    event_type IN ('skill', 'sub_agent', 'mcp', 'slash_command', 'message')
  )
)
CLUSTER BY (DATE(occurred_at), user_email)
COMMENT = 'Claude Codeイベント生データ（全データを広く蓄積）';
