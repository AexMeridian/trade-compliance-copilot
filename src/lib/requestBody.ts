import type { HonoRequest } from 'hono';

/**
 * The request's JSON body when it is a plain object, otherwise an empty object. A body that is missing, malformed, `null`, a
 * number or an array then fails the caller's ordinary "field is required" check with a 400, instead of throwing on the first
 * property read (which answered 500).
 */
export async function readObject<T extends object>(req: HonoRequest): Promise<Partial<T>> {
  const value: unknown = await req.json().catch(() => null);
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : {};
}
