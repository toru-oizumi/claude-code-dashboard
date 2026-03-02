# 動作確認手順

システム全体（Snowflake → Lambda → Hook → ダッシュボード）が正常に動作するかを確認するための手順書です。

---

## 前提

以下がインストール・設定済みであること。

- `aws` CLI（`aws sts get-caller-identity` でエラーが出ないこと）
- `sam` CLI（`sam --version` で確認）
- `snowsql` CLI（`snowsql --version` で確認）
- `mise install` 済み（`node --version` で v24.x が表示されること）
- `pnpm install` 済み

---

## Phase 1: Snowflake セットアップ確認

### Step 1-1. SQL を実行してスキーマ・テーブルを作成

`<DB>` を実際のデータベース名（例: `ANALYTICS`）に置換してから実行します。

```bash
cd snowflake

# DB名を変数にセット
export SNOW_DB="ANALYTICS"   # ← 実際のDB名に変更

snowsql -f <(sed "s/<DB>/$SNOW_DB/g" 01_schema.sql)
snowsql -f <(sed "s/<DB>/$SNOW_DB/g" 02_events_raw.sql)
snowsql -f <(sed "s/<DB>/$SNOW_DB/g" 03_model_pricing.sql)
snowsql -f <(sed "s/<DB>/$SNOW_DB/g" 04_dynamic_tables.sql)
```

### Step 1-2. テーブルの存在を確認

```sql
USE SCHEMA ANALYTICS.CLAUDE_CODE;

SHOW TABLES;
-- 期待値: EVENTS_RAW, MODEL_PRICING が表示される

SHOW DYNAMIC TABLES;
-- 期待値: USER_DAILY, TOOL_DAILY, WORKSPACE_DAILY が表示される

SELECT * FROM MODEL_PRICING LIMIT 5;
-- 期待値: Claude 4.x 系の料金データが 6件程度表示される
```

---

## Phase 2: AWS Secrets Manager にシークレット登録

### Step 2-1. シークレットを作成

```bash
aws secretsmanager create-secret \
  --name claude-code-dashboard \
  --region ap-northeast-1 \
  --secret-string '{
    "snowflake_account": "xxxxx.ap-northeast-1",
    "snowflake_user": "CLAUDE_HOOK_USER",
    "snowflake_password": "your-password",
    "snowflake_database": "ANALYTICS",
    "snowflake_warehouse": "COMPUTE_WH",
    "api_key": "test-api-key-12345"
  }'
```

> **注意:** `api_key` は後の手順で使います。控えておいてください。

### Step 2-2. 登録内容を確認

```bash
aws secretsmanager get-secret-value \
  --secret-id claude-code-dashboard \
  --region ap-northeast-1 \
  --query SecretString \
  --output text | jq .
```

全キーが表示されれば OK。

---

## Phase 3: Lambda デプロイ

### Step 3-1. GitHub Actions でデプロイ（推奨）

```bash
# リポジトリの Settings → Secrets → Actions に追加済みか確認
# AWS_DEPLOY_ROLE_ARN: arn:aws:iam::123456789012:role/GitHubActionsDeployRole

# main ブランチに push するだけで自動デプロイされる
git push origin main

# GitHub Actions のログで "SAM Deploy" ステップが成功することを確認
```

### Step 3-2. 手動デプロイの場合

```bash
cd packages/lambda
pnpm build
sam build
sam deploy
```

### Step 3-3. API エンドポイント URL を取得

```bash
aws cloudformation describe-stacks \
  --stack-name claude-code-dashboard \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text

# 出力例: https://abc123def.execute-api.ap-northeast-1.amazonaws.com/events
export ENDPOINT="上記のURL"
```

---

## Phase 4: Lambda 単体テスト（curl）

### Step 4-1. 認証なしで 401 が返ることを確認

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test"}'

# 期待値: 401
```

### Step 4-2. 不正な JSON で 400 が返ることを確認

```bash
curl -s -w "\n%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d 'NOT_JSON'

# 期待値: {"error":"Invalid JSON body"}  400
```

### Step 4-3. 必須フィールド不足で 400 が返ることを確認

```bash
curl -s -w "\n%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d '{"session_id":"test"}'

# 期待値: {"error":"user_email required"}  400
```

### Step 4-4. 正常リクエストで 200 + Snowflake に INSERT されることを確認

```bash
curl -s -w "\n%{http_code}" \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-api-key-12345" \
  -d '{
    "session_id": "verify-session-001",
    "user_email": "test@example.com",
    "cwd": "/tmp/test-project",
    "workspace": "owner/test-repo",
    "event_type": "skill",
    "event_name": "commit",
    "model": "claude-sonnet-4-6",
    "input_tokens": 1000,
    "output_tokens": 200,
    "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"
  }'

# 期待値: {"ok":true}  200
```

### Step 4-5. Snowflake でデータを確認

```sql
SELECT * FROM ANALYTICS.CLAUDE_CODE.EVENTS_RAW
WHERE session_id = 'verify-session-001';

-- 期待値: 1行表示される
```

---

## Phase 5: フック（Hook）の動作確認

### Step 5-1. ビルド

```bash
pnpm --filter @claude-code-dashboard/hook build
# dist/index.js が生成されることを確認
ls packages/hook/dist/index.js
```

### Step 5-2. 環境変数をセット

```bash
export CLAUDE_CODE_HOOK_ENDPOINT="$ENDPOINT"
export CLAUDE_CODE_HOOK_API_KEY="test-api-key-12345"
```

### Step 5-3. フックを手動で実行

以下の JSON を stdin に渡して、Snowflake にデータが入ることを確認します。

```bash
echo '{
  "session_id": "hook-verify-001",
  "tool_use": {
    "name": "Skill",
    "input": { "skill": "commit" }
  },
  "message": {
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 500,
      "output_tokens": 100
    }
  },
  "cwd": "'"$(pwd)"'"
}' | node packages/hook/dist/index.js

# エラーが出なければ OK（成功時は何も出力されない）
```

### Step 5-4. Snowflake でフックのデータを確認

```sql
SELECT session_id, user_email, event_type, event_name, model, occurred_at
FROM ANALYTICS.CLAUDE_CODE.EVENTS_RAW
WHERE session_id = 'hook-verify-001';

-- 期待値: event_type='skill', event_name='commit' の行が表示される
```

---

## Phase 6: Claude Code との統合確認

### Step 6-1. フックを Claude Code に登録

`~/.claude/settings.json` に追記します（既存の設定がある場合はマージしてください）。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/claude-code-dashboard/packages/hook/dist/index.js"
          }
        ]
      }
    ]
  }
}
```

> `/path/to/claude-code-dashboard` は実際のパスに変更してください。
> `npx @claude-code-dashboard/hook` でも動作しますが、ビルド済みの場合は直接パスを指定する方が高速です。

### Step 6-2. 環境変数を永続化

`~/.zshrc`（または `~/.bashrc`）に追記します。

```bash
export CLAUDE_CODE_HOOK_ENDPOINT="https://abc123def.execute-api.ap-northeast-1.amazonaws.com/events"
export CLAUDE_CODE_HOOK_API_KEY="test-api-key-12345"
```

```bash
source ~/.zshrc
```

### Step 6-3. Claude Code で何か操作する

Claude Code を起動して、スキルやツールを使います。
例えば `/commit` コマンドを実行するか、Agent ツールを使う操作をします。

### Step 6-4. Snowflake でリアルタイム確認

```sql
SELECT session_id, user_email, event_type, event_name, occurred_at
FROM ANALYTICS.CLAUDE_CODE.EVENTS_RAW
ORDER BY ingested_at DESC
LIMIT 10;

-- 期待値: 直近の操作が表示される
```

---

## Phase 7: Streamlit ダッシュボード確認

### Step 7-1. Streamlit in Snowflake でアプリを作成

1. Snowflake UI にログイン
2. 左メニュー「Streamlit」→「+ Streamlit App」
3. 以下を設定：
   - App name: `Claude Code Dashboard`
   - Database: `ANALYTICS`
   - Schema: `CLAUDE_CODE`
   - Warehouse: `COMPUTE_WH`
4. エディタに `streamlit/dashboard.py` の内容を貼り付け
5. 「Run」ボタンで起動

### Step 7-2. 表示内容を確認

以下のセクションにデータが表示されることを確認します。

| セクション | 確認ポイント |
|---|---|
| ユーザー別ランキング | `test@example.com` の行が表示される |
| ツール横断利用ランキング | スキルに `commit` が表示される |
| コスト推移 | 今日の日付にバーが表示される |
| ワークスペース別活用 | `owner/test-repo` が表示される |

> Dynamic Tables の更新ラグは最大 1 時間です。
> すぐに確認したい場合は以下で手動更新できます：
> ```sql
> ALTER DYNAMIC TABLE ANALYTICS.CLAUDE_CODE.USER_DAILY REFRESH;
> ALTER DYNAMIC TABLE ANALYTICS.CLAUDE_CODE.TOOL_DAILY REFRESH;
> ALTER DYNAMIC TABLE ANALYTICS.CLAUDE_CODE.WORKSPACE_DAILY REFRESH;
> ```

---

## トラブルシューティング

### Lambda が 500 を返す

Lambda のログを確認します。

```bash
aws logs tail /aws/lambda/claude-code-dashboard-ClaudeCodeIngestFunction \
  --since 10m \
  --region ap-northeast-1
```

よくある原因：
- Secrets Manager のキー名が間違っている（`snowflake_account` などのスペルを確認）
- Snowflake の認証情報が正しくない
- Snowflake のユーザーに `CLAUDE_CODE` スキーマへの INSERT 権限がない

### フックが動作しない（データが入らない）

フックはエラーを握りつぶして Claude Code に影響しない設計です。
デバッグするには環境変数を設定した上で手動実行（Step 5-3）を試してください。

### Dynamic Tables にデータが反映されない

```sql
-- 最終更新時刻を確認
SHOW DYNAMIC TABLES LIKE '%' IN SCHEMA ANALYTICS.CLAUDE_CODE;

-- 手動リフレッシュ
ALTER DYNAMIC TABLE ANALYTICS.CLAUDE_CODE.USER_DAILY REFRESH;
```
