/**
 * .env から SAM local 用の env.local.json を生成するスクリプト
 * Usage: node scripts/gen-local-env.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');

// .env をパース
let raw;
try {
  raw = readFileSync(envPath, 'utf-8');
} catch {
  console.error(`ERROR: .env not found at ${envPath}`);
  console.error('  cp .env.example .env して値を入力してください');
  process.exit(1);
}

const env = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
}

// 秘密鍵: SNOWFLAKE_PRIVATE_KEY_PATH を読んでファイル内容を展開
// （SAM local は Docker 内で動くのでホストのファイルパスは使えない）
function resolvePrivateKey() {
  if (env.SNOWFLAKE_PRIVATE_KEY) return env.SNOWFLAKE_PRIVATE_KEY;

  const keyPath = env.SNOWFLAKE_PRIVATE_KEY_PATH;
  if (!keyPath) {
    console.error('ERROR: SNOWFLAKE_PRIVATE_KEY or SNOWFLAKE_PRIVATE_KEY_PATH が未設定です');
    process.exit(1);
  }

  const absPath = keyPath.replace(/^~/, homedir());
  try {
    return readFileSync(absPath, 'utf-8').trim();
  } catch {
    console.error(`ERROR: 秘密鍵ファイルが見つかりません: ${absPath}`);
    process.exit(1);
  }
}

// Lambda に必要なキーを構築
const REQUIRED_KEYS = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_SCHEMA', 'API_KEY'];
const missing = REQUIRED_KEYS.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error(`ERROR: .env に以下のキーが未設定です: ${missing.join(', ')}`);
  process.exit(1);
}

const vars = {
  ...Object.fromEntries(REQUIRED_KEYS.map((k) => [k, env[k]])),
  SNOWFLAKE_PRIVATE_KEY: resolvePrivateKey(),
};

const output = { ClaudeCodeIngestFunction: vars };
const outPath = resolve(__dirname, '../env.local.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Generated: ${outPath}`);
