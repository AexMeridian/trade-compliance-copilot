// Spend and failure rules for the calculator's model calls, kept free of any network or database access so they can be tested directly.
// The numbers here are estimates from token counts and the model's published price; they are for budgeting, not billing.

/** Dollars per million tokens for the pinned model (claude-sonnet-4-6), from Anthropic's published price list. Update with CLAUDE_MODEL. */
export const PRICE_PER_MTOK = { input: 3, output: 15 };

export const DEFAULT_MONTHLY_BUDGET_USD = 30;

export function estimateUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
}

/** First day of the month containing `now`, as YYYY-MM-DD (UTC). */
export function monthStart(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

export function monthlyBudgetUsd(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_BUDGET_USD;
}

export type ModelFailure = 'credit' | 'auth' | 'budget';

/**
 * Sorts an error from the Anthropic SDK into a reason the owner must act on, or null for anything transient or ordinary (a bad request, a
 * timeout, a 5xx), which keep their normal handling. Matches on status and message so it does not depend on SDK class names.
 */
export function classifyModelError(err: unknown): ModelFailure | null {
  const e = err as { status?: number; message?: string } | null;
  if (!e || typeof e !== 'object') return null;
  const message = typeof e.message === 'string' ? e.message : '';
  if (e.status === 400 && /credit balance is too low/i.test(message)) return 'credit';
  if (e.status === 401 || e.status === 403) return 'auth';
  return null;
}

export const UNAVAILABLE_MESSAGE: Record<ModelFailure, string> = {
  credit: 'The calculator is paused while its AI service account is topped up. The rest of the site is unaffected. Please try again later.',
  auth: 'The calculator is paused because its AI service credentials need attention. The rest of the site is unaffected. Please try again later.',
  budget: 'The calculator has reached its monthly capacity for AI-assisted checks. The rest of the site is unaffected. Please try again next month.',
};
