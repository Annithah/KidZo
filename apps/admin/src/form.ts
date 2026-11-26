import { useCallback, useMemo, useState } from 'react';
import type { z } from 'zod';
import { ApiError, friendlyFieldErrors, friendlyMessage, type FieldErrors } from '@kidzo/shared';

/**
 * Live, friendly validation with the shared Zod schema. Errors appear for a field after it
 * loses focus, and for every field after a submit attempt. Server field errors merge in.
 */
export function useFormErrors<T extends z.ZodType>(schema: T, values: unknown) {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<FieldErrors>({});

  const all = useMemo(() => {
    const r = schema.safeParse(values);
    return r.success ? {} : friendlyFieldErrors(r.error.issues);
  }, [schema, values]);

  const visible = useMemo(() => {
    const out: FieldErrors = {};
    for (const [k, v] of Object.entries(all)) if (submitted || [...touched].some((t) => k === t || k.startsWith(`${t}.`))) out[k] = v;
    return { ...out, ...server };
  }, [all, touched, submitted, server]);

  const blur = useCallback((field: string) => setTouched((t) => new Set(t).add(field)), []);
  /** Marks the form submitted. Returns true when the values are valid. */
  const attempt = useCallback(() => {
    setSubmitted(true);
    setServer({});
    return Object.keys(all).length === 0;
  }, [all]);
  const reset = useCallback(() => {
    setTouched(new Set());
    setSubmitted(false);
    setServer({});
  }, []);
  /** Pulls VALIDATION_ERROR details from an API error into field errors. Returns true when it did. */
  const fromServer = useCallback((error: unknown) => {
    const fields = serverFieldErrors(error);
    setServer(fields);
    return Object.keys(fields).length > 0;
  }, []);

  return { errors: visible, allErrors: all, valid: Object.keys(all).length === 0, blur, attempt, reset, fromServer, submitted };
}

export function serverFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return {};
  const out: FieldErrors = {};
  for (const d of error.details as { path?: string; message?: string }[]) if (d.path && d.message) out[d.path] ??= friendlyMessage({ path: d.path, message: d.message });
  return out;
}
