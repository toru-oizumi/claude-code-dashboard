export type EventType = 'skill' | 'sub_agent' | 'mcp' | 'slash_command' | 'message';

export interface ClaudeCodeEvent {
  session_id: string;
  message_id?: string;
  user_email: string;
  user_name?: string;
  hostname?: string;
  cwd: string;
  workspace: string;
  event_type: EventType;
  event_name?: string;
  event_detail?: Record<string, unknown>;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  occurred_at: string;
}
