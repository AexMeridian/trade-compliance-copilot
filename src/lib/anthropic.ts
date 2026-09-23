import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types/env.js';

// Model pinned per project spec. Reasoning is captured as structured fields on
// the forced tool call itself (reasoning_steps, etc.) rather than via the
// `thinking` param -- this keeps the entire module output (answer + reasoning +
// grounded candidate selection) as one parseable, schema-validated object, which
// matters more here than raw chain-of-thought text for an "Analyst reasoning"
// panel that has to render reliably.
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

export function getClient(env: Env): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export class ClaudeGroundingError extends Error {}

/**
 * Calls Claude with a single tool, forced (tool_choice), and returns the
 * parsed tool input. This is the sole enforcement mechanism behind "never let
 * the model invent a code that isn't in the database": callers build the
 * tool's JSON Schema with `enum` arrays populated from real D1 candidate rows
 * fetched just before the call (see src/prompts/*.ts), so Claude is
 * structurally unable to emit a value outside that set. Route handlers still
 * perform a defensive re-check against the same candidate list before
 * persisting (never trust the wire blindly) -- see src/routes/*.ts.
 */
export async function callClaudeTool<T>(
  env: Env,
  opts: {
    system: string;
    userContent: string;
    tool: Anthropic.Tool;
    maxTokens?: number;
  }
): Promise<T> {
  const client = getClient(env);
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: 'tool', name: opts.tool.name },
    messages: [{ role: 'user', content: opts.userContent }],
  });

  if ((response.stop_reason as string) === 'refusal') {
    throw new ClaudeGroundingError('Claude declined to answer (refusal).');
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  );
  if (!toolUse) {
    throw new ClaudeGroundingError(
      `Claude did not return a tool_use block (stop_reason: ${response.stop_reason}).`
    );
  }
  return toolUse.input as T;
}
