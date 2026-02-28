-- Claude Code Activity Dashboard - Model Pricing Master

USE SCHEMA <DB>.CLAUDE_CODE;

CREATE TABLE IF NOT EXISTS MODEL_PRICING (
  model                 STRING  NOT NULL,
  input_cost_per_1k     FLOAT   NOT NULL COMMENT '$ per 1k input tokens',
  output_cost_per_1k    FLOAT   NOT NULL COMMENT '$ per 1k output tokens',
  cache_read_per_1k     FLOAT   DEFAULT 0 COMMENT '$ per 1k cache read tokens',
  cache_write_per_1k    FLOAT   DEFAULT 0 COMMENT '$ per 1k cache write tokens',
  updated_at            TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT pk_model_pricing PRIMARY KEY (model)
)
COMMENT = 'Anthropicモデル別料金マスタ（2026年2月時点）';

-- 初期データ投入
INSERT INTO MODEL_PRICING (model, input_cost_per_1k, output_cost_per_1k, cache_read_per_1k, cache_write_per_1k) VALUES
  ('claude-opus-4-6',          0.015,  0.075,  0.0015,  0.01875),
  ('claude-opus-4-5-20251101', 0.015,  0.075,  0.0015,  0.01875),
  ('claude-sonnet-4-6',        0.003,  0.015,  0.0003,  0.00375),
  ('claude-sonnet-4-5',        0.003,  0.015,  0.0003,  0.00375),
  ('claude-haiku-4-5',         0.0008, 0.004,  0.00008, 0.001),
  ('claude-haiku-4-5-20251001',0.0008, 0.004,  0.00008, 0.001)
ON CONFLICT (model) DO NOTHING;
