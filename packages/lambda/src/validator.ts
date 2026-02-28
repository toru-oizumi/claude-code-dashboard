import type { ClaudeCodeEvent, EventType } from './types.js';

const VALID_EVENT_TYPES: EventType[] = ['skill', 'sub_agent', 'mcp', 'slash_command', 'message'];

export function validate(body: unknown): ClaudeCodeEvent {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid body');
  }

  const e = body as Record<string, unknown>;

  if (!e.session_id || typeof e.session_id !== 'string') throw new Error('session_id required');
  if (!e.user_email || typeof e.user_email !== 'string') throw new Error('user_email required');
  if (!e.cwd || typeof e.cwd !== 'string') throw new Error('cwd required');
  if (!e.workspace || typeof e.workspace !== 'string') throw new Error('workspace required');
  if (!e.occurred_at || typeof e.occurred_at !== 'string') throw new Error('occurred_at required');

  if (!e.event_type || !VALID_EVENT_TYPES.includes(e.event_type as EventType)) {
    throw new Error(`Invalid event_type: ${e.event_type}`);
  }

  return e as unknown as ClaudeCodeEvent;
}
