export type EventType = 'skill' | 'sub_agent' | 'mcp' | 'slash_command' | 'message';

export interface HookInput {
  session_id: string;
  transcript_path?: string;
  tool_use?: {
    name: string;
    input?: Record<string, unknown>;
  };
  tool_result?: unknown;
  message?: {
    role: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  cwd?: string;
}

export interface EventPayload {
  session_id: string;
  user_email: string;
  user_name?: string;
  hostname: string;
  cwd: string;
  workspace: string;
  event_type: EventType;
  event_name?: string;
  event_detail?: Record<string, unknown>;
  model?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  occurred_at: string;
}
