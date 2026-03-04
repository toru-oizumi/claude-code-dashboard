-- Claude Code Activity Dashboard - User / Role Setup
-- 実行前に <DB> を実際のデータベース名に置換してください

-- ============================================================
-- Step 1: キーペア生成（ターミナルで実行）
-- ============================================================
-- # 秘密鍵生成（パスフレーズなし）
-- openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out rsa_key.p8
--
-- # 公開鍵生成
-- openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
--
-- # Snowflake に登録する公開鍵の内容（ヘッダー/フッター除いた1行）
-- grep -v "PUBLIC KEY" rsa_key.pub | tr -d '\n'

-- ============================================================
-- Step 2: ロール作成
-- ============================================================
CREATE ROLE IF NOT EXISTS CLAUDE_HOOK_ROLE;

-- ============================================================
-- Step 3: ユーザー作成 & 公開鍵登録
-- ============================================================
-- 公開鍵を上記コマンドで取得した値（1行）に置換してください
CREATE USER IF NOT EXISTS CLAUDE_HOOK_USER
  DEFAULT_ROLE      = CLAUDE_HOOK_ROLE
  DEFAULT_WAREHOUSE = COMPUTE_WH
  RSA_PUBLIC_KEY    = '<Step 1 で取得した公開鍵を貼り付け>'
  COMMENT           = 'Claude Code Dashboard - Lambda ingest user';

-- 既存ユーザーに公開鍵を後から設定する場合:
-- ALTER USER CLAUDE_HOOK_USER SET RSA_PUBLIC_KEY = '<公開鍵>';

-- ============================================================
-- Step 4: 権限付与（最小権限）
-- ============================================================
GRANT ROLE CLAUDE_HOOK_ROLE TO USER CLAUDE_HOOK_USER;

GRANT USAGE ON WAREHOUSE COMPUTE_WH          TO ROLE CLAUDE_HOOK_ROLE;
GRANT USAGE ON DATABASE   <DB>               TO ROLE CLAUDE_HOOK_ROLE;
GRANT USAGE ON SCHEMA     <DB>.CLAUDE_CODE   TO ROLE CLAUDE_HOOK_ROLE;

-- INSERT のみ（SELECT 不要）
GRANT INSERT ON TABLE <DB>.CLAUDE_CODE.EVENTS_RAW TO ROLE CLAUDE_HOOK_ROLE;

-- ============================================================
-- Step 5: 動作確認（snowsql で接続テスト）
-- ============================================================
-- snowsql \
--   --accountname NVQTVBO-JSB24064 \
--   --username CLAUDE_HOOK_USER \
--   --private-key-path rsa_key.p8 \
--   --authenticator jwt \
--   -q "SELECT CURRENT_USER(), CURRENT_ROLE();"
--
-- 期待値: CLAUDE_HOOK_USER / CLAUDE_HOOK_ROLE
