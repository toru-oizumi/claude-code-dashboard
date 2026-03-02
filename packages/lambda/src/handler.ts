import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { env } from './env.js';
import { insertEvent } from './snowflake.js';
import { ValidationError, validate } from './validator.js';

function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, body: JSON.stringify(body) };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const apiKey = event.headers['x-api-key'] ?? event.headers['X-Api-Key'];

  if (apiKey !== env.API_KEY) {
    return json(401, { error: 'Unauthorized' });
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  try {
    const claudeEvent = validate(body);
    await insertEvent(claudeEvent);
    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', message, err);
    return json(err instanceof ValidationError ? 400 : 500, { error: message });
  }
};
