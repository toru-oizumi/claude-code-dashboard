# Claude Code Activity Dashboard

チーム全体の Claude Code 活用状況を可視化するダッシュボード。
Claude Code のフックから使用イベントを収集し、Snowflake に蓄積、Streamlit で分析・表示します。

## アーキテクチャ

```
Claude Code (各開発者のローカル)
    │
    │  PostToolUse フック（JSON → stdin）
    ▼
@claude-code-dashboard/hook  （Node.js CLI）
    │
    │  HTTP POST  x-api-key 認証
    ▼
AWS Lambda + API Gateway (HTTP API)
    │
    │  snowflake-sdk
    ▼
Snowflake  CLAUDE_CODE スキーマ
    ├── EVENTS_RAW          生イベントテーブル
    ├── MODEL_PRICING        料金マスタ
    └── Dynamic Tables
        ├── USER_DAILY       ユーザー×日別集計
        ├── TOOL_DAILY       ツール別集計
        └── WORKSPACE_DAILY  ワークスペース別集計
            │
            ▼
    Streamlit in Snowflake  ダッシュボード
```

## リポジトリ構成

```
.
├── packages/
│   ├── hook/               Claude Code フック（Node.js CLI）
│   │   └── src/
│   │       ├── index.ts    エントリーポイント（stdin 読み取り）
│   │       ├── extractor.ts イベント抽出ロジック
│   │       ├── sender.ts   Lambda への HTTP 送信
│   │       └── types.ts    型定義
│   └── lambda/             AWS Lambda 受信関数
│       ├── src/
│       │   ├── handler.ts  Lambda ハンドラー
│       │   ├── validator.ts リクエストバリデーション
│       │   ├── snowflake.ts Snowflake 接続・INSERT
│       │   ├── env.ts      環境変数アクセサ
│       │   └── types.ts    型定義
│       ├── events/
│       │   └── test.json   SAM local 用テストイベント
│       ├── template.yaml   SAM テンプレート
│       └── samconfig.toml  SAM デプロイ設定
├── snowflake/
│   ├── 01_schema.sql       スキーマ作成
│   ├── 02_events_raw.sql   生イベントテーブル
│   ├── 03_model_pricing.sql 料金マスタ + 初期データ
│   └── 04_dynamic_tables.sql マートレイヤー（Dynamic Tables）
└── streamlit/
    └── dashboard.py        Streamlit ダッシュボード
```

## セットアップ

### 前提条件

- [mise](https://mise.jdx.dev/) インストール済み（Node.js 24 / pnpm を自動セットアップ）
- AWS CLI + 適切な IAM 権限
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Snowflake アカウント

### 1. 依存関係のインストール

```bash
mise install        # Node.js 24 + pnpm のセットアップ
pnpm install
```

### 2. Snowflake セットアップ

`snowflake/` 以下の SQL を順番に実行します。実行前に `<DB>` を実際のデータベース名に置換してください。

```bash
# 例: sed で置換してから実行
sed 's/<DB>/MY_DATABASE/g' snowflake/01_schema.sql | snowsql
sed 's/<DB>/MY_DATABASE/g' snowflake/02_events_raw.sql | snowsql
sed 's/<DB>/MY_DATABASE/g' snowflake/03_model_pricing.sql | snowsql
sed 's/<DB>/MY_DATABASE/g' snowflake/04_dynamic_tables.sql | snowsql
```

`MODEL_PRICING` テーブルには Claude 4.x / 4.5 系の料金データが初期投入済みです。
新モデルが追加された場合は `03_model_pricing.sql` を参照して `INSERT` を追加してください。

### 3. AWS Secrets Manager にシークレットを登録

シークレットは用途別に2つ作成します。

**[1] キー/値シークレット** — Snowflake 接続情報 + API キー

```bash
aws secretsmanager create-secret \
  --name claude-code-dashboard \
  --region us-west-2 \
  --secret-string '{
    "snowflake_account": "NVQTVBO-JSB24064",
    "snowflake_user": "CLAUDE_HOOK_USER",
    "snowflake_database": "YOUR_DB",
    "snowflake_warehouse": "COMPUTE_WH",
    "api_key": "your-random-api-key"
  }'
```

**[2] プレーンテキストシークレット** — RSA 秘密鍵（PEM ファイルをそのまま格納）

```bash
aws secretsmanager create-secret \
  --name claude-code-dashboard/private-key \
  --region us-west-2 \
  --secret-string file://rsa_key.p8
```

`api_key` は任意のランダム文字列です。フック側の `CLAUDE_CODE_HOOK_API_KEY` と一致させてください。

### 4. Lambda デプロイ

GitHub Actions (`push` to `main`) で自動デプロイされます。
手動デプロイする場合：

```bash
cd packages/lambda
pnpm build
sam build
sam deploy
```

デプロイ完了後、Outputs に表示される `ApiEndpoint` の URL を控えてください。

### 5. Claude Code フック設定

`~/.claude/settings.json` に以下を追加します：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-code-dashboard/hook"
          }
        ]
      }
    ]
  }
}
```

環境変数を設定します（`~/.zshrc` や `~/.bashrc` に追記）：

```bash
export CLAUDE_CODE_HOOK_ENDPOINT="https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/events"
export CLAUDE_CODE_HOOK_API_KEY="your-random-api-key"
```

### 6. Streamlit in Snowflake でダッシュボードを作成

Snowflake の UI で Streamlit アプリを新規作成し、`streamlit/dashboard.py` の内容を貼り付けます。
ダッシュボードが存在するデータベースと `CLAUDE_CODE` スキーマへのアクセス権を持つロールで実行してください。

---

## 収集されるイベント

| `event_type` | 発生タイミング | `event_name` の内容 |
|---|---|---|
| `skill` | スキル（`/xxx` コマンド）呼び出し時 | スキル名（例: `commit`） |
| `sub_agent` | Agent ツール呼び出し時 | サブエージェント種別 |
| `mcp` | MCP ツール呼び出し時 | ツール名（例: `mcp__github__create_pr`） |
| `message` | その他のツール呼び出し時 | なし |

各イベントにはトークン使用量（`input_tokens` / `output_tokens` / キャッシュ）も付与されます。

---

## 開発

### ローカルでの動作確認

```bash
# フックの手動テスト（JSON を stdin に渡す）
echo '{"session_id":"test","tool_use":{"name":"Skill","input":{"skill":"commit"}},"cwd":"/path/to/repo"}' \
  | CLAUDE_CODE_HOOK_ENDPOINT=http://localhost:3000/events \
    CLAUDE_CODE_HOOK_API_KEY=test \
    pnpm --filter @claude-code-dashboard/hook dev

# Lambda をローカル実行（Docker 必要）
cd packages/lambda
pnpm build && sam build
sam local invoke ClaudeCodeIngestFunction --event events/test.json
```

### 型チェック

```bash
pnpm --filter @claude-code-dashboard/lambda typecheck
pnpm --filter @claude-code-dashboard/hook typecheck
```

### Lint / フォーマット

```bash
pnpm biome check .
pnpm biome format --write .
```

---

## インフラ構成（AWS）

| リソース | 内容 |
|---|---|
| Lambda | Node.js 22.x / arm64 / 256MB / タイムアウト 30s |
| API Gateway | HTTP API（`POST /events`） |
| Secrets Manager | Snowflake 認証情報 + API キー |
| IAM | OIDC による GitHub Actions からのロール引き受け |

デプロイは `us-west-2`（オレゴン）固定です。変更する場合は `samconfig.toml` の `region` を修正してください。
