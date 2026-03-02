import type { ClaudeCodeEvent, EventType } from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_EVENT_TYPES: EventType[] = ['skill', 'sub_agent', 'mcp', 'slash_command', 'message'];

export function validate(body: unknown): ClaudeCodeEvent {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Invalid body');
  }

  const e = body as Record<string, unknown>;

  if (!e.session_id || typeof e.session_id !== 'string') throw new ValidationError('session_id required');
  if (!e.user_email || typeof e.user_email !== 'string') throw new ValidationError('user_email required');
  if (!e.cwd || typeof e.cwd !== 'string') throw new ValidationError('cwd required');
  if (!e.workspace || typeof e.workspace !== 'string') throw new ValidationError('workspace required');
  if (!e.occurred_at || typeof e.occurred_at !== 'string') throw new ValidationError('occurred_at required');

  if (!e.event_type || !VALID_EVENT_TYPES.includes(e.event_type as EventType)) {
    throw new ValidationError(`Invalid event_type: ${e.event_type}`);
  }

  return e as unknown as ClaudeCodeEvent;
}
