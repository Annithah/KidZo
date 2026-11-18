import type { ReactNode } from 'react';
import { LOCALES, LOCALE_LABELS, type LocalizedText } from '@kidzo/shared';
import { describeError } from '../api';

export function Loading() {
  return (
    <div className="center" role="status">
      <span className="muted">Loading...</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { message, problems } = describeError(error);
  return (
    <div className="alert error" role="alert">
      {message}
      {problems.length > 0 ? (
        <ul>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn small secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card center muted">{children}</div>;
}

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string | undefined; hint?: string }) {
  return (
    <label className="field">
      {label}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="muted small">{hint}</span> : null}
    </label>
  );
}

/** Edits a LocalizedText: English required, other languages optional. */
export function LocalizedInput({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
}) {
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 800, marginBottom: 6 }}>{label}</legend>
      <div className="lang-grid">
        {LOCALES.map((lang) => {
          const props = {
            className: 'input',
            'aria-label': `${label} (${LOCALE_LABELS[lang].native})`,
            placeholder: `${LOCALE_LABELS[lang].short}${lang === 'en' ? ' (required)' : ''}`,
            value: value[lang] ?? '',
            onChange: (e: { target: { value: string } }) => {
              const next = { ...value, [lang]: e.target.value };
              if (lang !== 'en' && e.target.value === '') delete next[lang];
              onChange(next);
            },
          };
          return multiline ? <textarea key={lang} {...props} /> : <input key={lang} {...props} />;
        })}
      </div>
    </fieldset>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
