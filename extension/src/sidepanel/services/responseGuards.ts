/**
 * Runtime type guards for API responses.
 * Prevents silent UI crashes when the backend returns an unexpected shape.
 */

import type { SolveResponse } from './contracts';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Validates that `data` has the expected shape of a SolveResponse.
 */
export function isSolveResponse(data: unknown): data is SolveResponse {
  if (!isObject(data)) return false;
  if (data.api_version !== 'v1') return false;
  if (typeof data.answer !== 'string') return false;
  if (typeof data.explanation !== 'string') return false;
  if (!Array.isArray(data.steps)) return false;
  if (!isObject(data.usage)) return false;
  if (!isObject(data.metadata)) return false;
  if (!Array.isArray(data.suggestions)) return false;
  return true;
}

/**
 * Asserts that `data` is a valid SolveResponse. Throws with a
 * descriptive error message if validation fails.
 */
export function assertSolveResponse(data: unknown): SolveResponse {
  if (isSolveResponse(data)) return data;

  // Build a diagnostic message
  const missing: string[] = [];
  if (!isObject(data)) {
    throw new Error('Invalid response: expected an object from the backend.');
  }
  if (data.api_version !== 'v1') missing.push(`api_version (got "${String(data.api_version)}")`);
  if (typeof data.answer !== 'string') missing.push('answer');
  if (typeof data.explanation !== 'string') missing.push('explanation');
  if (!Array.isArray(data.steps)) missing.push('steps');
  if (!isObject(data.usage)) missing.push('usage');
  if (!isObject(data.metadata)) missing.push('metadata');
  if (!Array.isArray(data.suggestions)) missing.push('suggestions');

  throw new Error(
    `Invalid response from backend. Missing or invalid fields: ${missing.join(', ')}. ` +
    'Please try again or update the extension.'
  );
}
