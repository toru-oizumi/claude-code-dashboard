import snowflake from 'snowflake-sdk';
import { env } from './env.js';
import type { ClaudeCodeEvent } from './types.js';

let connectionPromise: Promise<snowflake.Connection> | null = null;

function getConnection(): Promise<snowflake.Connection> {
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: env.SNOWFLAKE_ACCOUNT,
      username: env.SNOWFLAKE_USER,
      password: env.SNOWFLAKE_PASSWORD,
      database: env.SNOWFLAKE_DATABASE,
      schema: 'CLAUDE_CODE',
      warehouse: env.SNOWFLAKE_WAREHOUSE,
    });

    conn.connect((err, connection) => {
      if (err) {
        connectionPromise = null;
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });

  return connectionPromise;
}

export async function insertEvent(event: ClaudeCodeEvent): Promise<void> {
  const conn = await getConnection();

  const sql = `
    INSERT INTO EVENTS_RAW (
      session_id, message_id,
      user_email, user_name, hostname, cwd, workspace,
      event_type, event_name, event_detail,
      model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      occurred_at
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, PARSE_JSON(?),
      ?, ?, ?, ?, ?,
      ?::TIMESTAMP_TZ
    )
  `;

  const binds: (string | number | null)[] = [
    event.session_id,
    event.message_id ?? null,
    event.user_email,
    event.user_name ?? null,
    event.hostname ?? null,
    event.cwd,
    event.workspace,
    event.event_type,
    event.event_name ?? null,
    event.event_detail ? JSON.stringify(event.event_detail) : null,
    event.model ?? null,
    event.input_tokens ?? 0,
    event.output_tokens ?? 0,
    event.cache_read_tokens ?? 0,
    event.cache_write_tokens ?? 0,
    event.occurred_at,
  ];

  await new Promise<void>((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err) => (err ? reject(err) : resolve()),
    });
  });
}
