import { extractEvent } from './extractor.js';
import { sendEvent } from './sender.js';
import type { HookInput } from './types.js';

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return;

  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    // JSONパース失敗はサイレントにスキップ
    return;
  }

  const payload = extractEvent(input);
  if (!payload) return;

  try {
    await sendEvent(payload);
  } catch {
    // Lambda送信失敗はサイレントに終了（Claude Codeを止めない）
  }
}

main().catch(() => {
  // エラーはすべて握りつぶしてClaude Codeに影響させない
  process.exit(0);
});
