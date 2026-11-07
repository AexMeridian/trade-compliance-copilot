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
  // Explicit limits: the SDK default is a 10-minute timeout, long enough for one hung
  // call to hold a request (and a user) far past any useful answer. 60s covers the
  // slowest legitimate forced-tool call; two retries absorb transient 429/5xx.
  // A user-level key (sk-ant-usr-...) is not tied to a workspace, so Anthropic needs the workspace named on every request.
  // A workspace-scoped key does not need it; leave ANTHROPIC_WORKSPACE_ID unset then.
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    timeout: 60_000,
    maxRetries: 2,
    ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
  });
}

export class ClaudeGroundingError extends Error {}
export class ClaudeDailyCapError extends Error {}

/**
 * Counts one Claude call against the day's shared ceiling (CLAUDE_DAILY_CAP, default 300 per UTC day; one counter row in D1).
 * Called immediately before each real call, so requests that fail validation never use it up. If the counter cannot be read,
 * the call is allowed rather than blocked.
 */
export async function claimClaudeCall(env: Env): Promise<void> {
  const cap = Number(env.CLAUDE_DAILY_CAP ?? 300);
  if (!Number.isFinite(cap) || cap <= 0) return;
  let used = 0;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const row = await env.DB.prepare(
      `INSERT INTO pulse_feed_state (source_key, last_note) VALUES (?1, '1')
       ON CONFLICT(source_key) DO UPDATE SET last_note = CAST(CAST(pulse_feed_state.last_note AS INTEGER) + 1 AS TEXT)
       RETURNING last_note`
    )
      .bind(`claude-calls:${day}`)
      .first<{ last_note: string }>();
    used = Number(row?.last_note ?? 0);
  } catch {
    return;
  }
  if (used > cap) throw new ClaudeDailyCapError('Daily Claude call ceiling reached.');
}

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
  const cacheKey = env.MODEL_CACHE === 'off' ? null : await modelCacheKey(opts);
  if (cacheKey) {
    const hit = await readModelCache<T>(env, cacheKey);
    if (hit !== null) return hit;
  }
  await claimClaudeCall(env);
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
  // Token counts per call, so spend can be added up from the logs instead of estimated.
  console.log(`claude-usage ${opts.tool.name} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
  if (cacheKey) await writeModelCache(env, cacheKey, opts.tool.name, toolUse.input);
  return toolUse.input as T;
}

export const MODEL_CACHE_DAYS = 14;

async function modelCacheKey(opts: { system: string; userContent: string; tool: Anthropic.Tool }): Promise<string> {
  const text = JSON.stringify([CLAUDE_MODEL, opts.system, opts.userContent, opts.tool]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The cache only ever saves money, so any failure reading or writing it is ignored and the call goes ahead as normal.
async function readModelCache<T>(env: Env, key: string): Promise<T | null> {
  try {
    const cutoff = new Date(Date.now() - MODEL_CACHE_DAYS * 86_400_000).toISOString();
    const row = await env.DB.prepare(`SELECT output FROM model_cache WHERE cache_key = ?1 AND created_at > ?2`).bind(key, cutoff).first<{ output: string }>();
    if (!row) return null;
    await env.DB.prepare(`UPDATE model_cache SET hits = hits + 1 WHERE cache_key = ?1`).bind(key).run();
    return JSON.parse(row.output) as T;
  } catch {
    return null;
  }
}

async function writeModelCache(env: Env, key: string, tool: string, output: unknown): Promise<void> {
  try {
    await env.DB.prepare(`INSERT OR REPLACE INTO model_cache (cache_key, tool_name, output, created_at, hits) VALUES (?1, ?2, ?3, ?4, 0)`)
      .bind(key, tool, JSON.stringify(output), new Date().toISOString())
      .run();
  } catch {
    /* ignore */
  }
}
