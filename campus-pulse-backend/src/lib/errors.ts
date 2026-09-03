export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_TITLE'
  | 'INVALID_DESCRIPTION'
  | 'INVALID_BODY'
  | 'INVALID_CATEGORY'
  | 'INVALID_PRIORITY'
  | 'INVALID_LOCATION'
  | 'INVALID_DEPARTMENT'
  | 'INVALID_ASSIGNEE'
  | 'INVALID_TRANSITION'
  | 'RESOLUTION_REASON_REQUIRED'
  | 'REOPEN_WINDOW_EXPIRED'
  | 'INVALID_FILE_SIZE'
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_EXTENSION'
  | 'INVALID_PATH'
  | 'CONFLICT'
  | 'INTERNAL';

export interface ApiError {
  error: { code: ErrorCode | string; message: string; details?: unknown };
}

export function apiError(code: string, message: string, details?: unknown): ApiError {
  return { error: { code, message, ...(details !== undefined ? { details } : {}) } };
}

/**
 * Maps a Supabase/Postgres error to the consistent API error envelope.
 * Postgres exceptions from RPCs look like: "CODE: message"
 */
export function mapDbError(err: unknown): ApiError {
  const raw = (err as { message?: string })?.message ?? String(err);
  const m = raw.match(/^([A-Z_]+):\s*(.*)$/);
  if (m) return apiError(m[1], m[2]);
  if (/duplicate key/i.test(raw)) return apiError('CONFLICT', 'Duplicate value', raw);
  if (/violates foreign key/i.test(raw)) return apiError('INVALID_REFERENCE', 'Related record not found', raw);
  if (/violates check constraint/i.test(raw)) return apiError('INVALID_DATA', 'Data failed validation', raw);
  return apiError('INTERNAL', 'Unexpected error', raw);
}
