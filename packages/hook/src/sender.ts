import type { EventPayload } from './types.js';

const ENDPOINT = process.env.CLAUDE_CODE_HOOK_ENDPOINT;
const API_KEY = process.env.CLAUDE_CODE_HOOK_API_KEY;

export async function sendEvent(payload: EventPayload): Promise<void> {
  if (!ENDPOINT || !API_KEY) {
    // 環境変数未設定の場合はサイレントにスキップ
    return;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
}
