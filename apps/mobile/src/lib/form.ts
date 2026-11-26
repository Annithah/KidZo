import type { z } from 'zod';
import { ApiError, friendlyFieldErrors, friendlyMessage, type FieldErrors } from '@kidzo/shared';

export type { FieldErrors };

/** Client side validation with the shared Zod schema, returning friendly per-field messages. */
export function validate<T extends z.ZodType>(schema: T, data: unknown): { data: z.infer<T> | null; errors: FieldErrors } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, errors: {} };
  return { data: null, errors: friendlyFieldErrors(result.error.issues) };
}

/** Validates one field on blur: returns only that field's message, if any. */
export function validateField<T extends z.ZodType>(schema: T, data: unknown, field: string): string | undefined {
  return validate(schema, data).errors[field];
}

/** Field errors from a server VALIDATION_ERROR response. */
export function serverFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return {};
  const errors: FieldErrors = {};
  for (const item of error.details as { path?: string; message?: string }[]) {
    if (item.path && item.message) errors[item.path] ??= friendlyMessage({ path: item.path, message: item.message });
  }
  return errors;
}
