import type { z } from 'zod';
import { ApiError } from '@kidzo/shared';

export type FieldErrors = Record<string, string>;

/** Client side validation with the shared Zod schema. */
export function validate<T extends z.ZodType>(schema: T, data: unknown): { data: z.infer<T> | null; errors: FieldErrors } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

/** Field errors from a server VALIDATION_ERROR response. */
export function serverFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return {};
  const errors: FieldErrors = {};
  for (const item of error.details as { path?: string; message?: string }[]) {
    if (item.path && item.message) errors[item.path] ??= item.message;
  }
  return errors;
}
