import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import type { EventPayload, EventType, HookInput } from './types.js';

function getUserEmail(): string {
  try {
    return execFileSync('git', ['config', '--global', 'user.email'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return os.userInfo().username;
  }
}

function getUserName(): string {
  try {
    return execFileSync('git', ['config', '--global', 'user.name'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return os.userInfo().username;
  }
}

function extractWorkspace(cwd: string): string {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    const match = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    // gitリポジトリでない場合はcwdから推測
  }
  const parts = cwd.split('/');
  return parts.slice(-2).join('/');
}

function extractEventType(toolName: string): { type: EventType; name: string } {
  if (toolName === 'Skill') return { type: 'skill', name: '' };
  if (toolName === 'Agent') return { type: 'sub_agent', name: '' };
  if (toolName.startsWith('mcp__')) return { type: 'mcp', name: toolName };
  return { type: 'message', name: '' };
}

export function extractEvent(input: HookInput): EventPayload | null {
  const toolUse = input.tool_use;
  if (!toolUse) return null;

  const { type: eventType } = extractEventType(toolUse.name);

  let eventName: string | undefined;
  let eventDetail: Record<string, unknown> | undefined;

  if (eventType === 'skill') {
    eventName = toolUse.input?.skill as string | undefined;
    eventDetail = toolUse.input;
  } else if (eventType === 'sub_agent') {
    eventName = toolUse.input?.subagent_type as string | undefined;
    eventDetail = toolUse.input;
  } else if (eventType === 'mcp') {
    eventName = toolUse.name;
    eventDetail = toolUse.input;
  }

  const usage = input.message?.usage;
  const cwd = input.cwd ?? process.cwd();

  return {
    session_id: input.session_id,
    user_email: getUserEmail(),
    user_name: getUserName(),
    hostname: os.hostname(),
    cwd,
    workspace: extractWorkspace(cwd),
    event_type: eventType,
    event_name: eventName,
    event_detail: eventDetail,
    model: input.message?.model,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
    occurred_at: new Date().toISOString(),
  };
}
