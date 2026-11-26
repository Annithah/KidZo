import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LOCALES, LOCALE_LABELS, type Locale, type LocalizedText } from '@kidzo/shared';
import { describeError } from '../api';
import { Art } from './Art';
import { Icon, type IconName } from './Icon';

type ButtonTone = 'primary' | 'secondary' | 'mint' | 'danger' | 'ghost';

export function Button({
  tone = 'primary',
  small,
  icon,
  busy,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; small?: boolean; icon?: IconName; busy?: boolean }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || busy} aria-busy={busy || undefined} className={`btn ${tone === 'primary' ? '' : tone} ${small ? 'small' : ''} ${className ?? ''}`.trim()}>
      {busy ? <Icon name="sync" size={16} className="spin" /> : icon ? <Icon name={icon} size={small ? 16 : 18} accent="var(--coral-200)" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, ...rest }: { icon: IconName; label: string; onClick?: () => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick} {...rest}>
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Skeleton({ rows = 4, height = 18 }: { rows?: number; height?: number }) {
  return (
    <div className="stack tight" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function Loading() {
  return (
    <div className="card">
      <Skeleton rows={6} />
    </div>
  );
}

/** Server or network failure. Shows the summary only; field problems belong under fields. */
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { message } = describeError(error);
  return (
    <div className="alert error" role="alert">
      <Icon name="warning" size={20} />
      <div style={{ flex: 1 }}>
        {message}
        {onRetry ? (
          <div style={{ marginTop: 8 }}>
            <Button tone="secondary" small icon="sync" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Empty({ children, art = 'scene.empty', title, action }: { children?: ReactNode; art?: string; title?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Art art={art} size={120} />
      {title ? <strong>{title}</strong> : null}
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Label, control, then either an inline error (with icon) or a hint. */
export function Field({ label, children, error, hint, id }: { label: string; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode; error?: string | undefined; hint?: string; id?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {children({ id: fieldId, 'aria-invalid': !!error, ...(describedBy ? { 'aria-describedby': describedBy } : {}) })}
      {error ? (
        <span className="field-error" id={`${fieldId}-error`} role="alert">
          <Icon name="warning" size={14} />
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Edits a LocalizedText. Each language shows its own inline error (keys like "title.en"). */
export function LocalizedInput({
  label,
  value,
  onChange,
  onBlur,
  multiline,
  errors = {},
  path,
  languages,
}: {
  label: string;
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  onBlur?: (lang: Locale) => void;
  multiline?: boolean;
  errors?: Record<string, string>;
  /** Error key prefix, for example "title" or "body.nodes.2.text". */
  path?: string;
  /** Languages that are required (shown first and marked). */
  languages?: readonly Locale[];
}) {
  const required = new Set(languages ?? ['en']);
  return (
    <fieldset className="stack tight">
      <legend>{label}</legend>
      <div className="lang-grid">
        {LOCALES.map((lang) => {
          const err = path ? errors[`${path}.${lang}`] : undefined;
          const props = {
            className: 'input',
            placeholder: required.has(lang) ? 'Required' : 'Optional',
            value: value[lang] ?? '',
            onChange: (e: { target: { value: string } }) => {
              const next = { ...value, [lang]: e.target.value };
              if (lang !== 'en' && e.target.value === '') delete next[lang];
              onChange(next);
            },
            onBlur: () => onBlur?.(lang),
          };
          return (
            <Field key={lang} label={`${LOCALE_LABELS[lang].native}${required.has(lang) ? ' *' : ''}`} error={err}>
              {(a11y) => (multiline ? <textarea {...props} {...a11y} /> : <input {...props} {...a11y} />)}
            </Field>
          );
        })}
      </div>
    </fieldset>
  );
}

const STATUS_ICON: Record<string, IconName> = { published: 'checkCircle', draft: 'edit', review: 'eye', unpublished: 'unpublish', archived: 'archive' };
const STATUS_TEXT: Record<string, string> = { review: 'in review' };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <Icon name={STATUS_ICON[status] ?? 'info'} size={12} />
      {STATUS_TEXT[status] ?? status}
    </span>
  );
}

export function PageHeader({ kicker, title, description, actions }: { kicker?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="titles">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function ButtonLink({ to, icon, children, tone = 'primary' }: { to: string; icon?: IconName; children: ReactNode; tone?: ButtonTone }) {
  return (
    <Link to={to} className={`btn ${tone === 'primary' ? '' : tone}`}>
      {icon ? <Icon name={icon} size={18} accent="var(--coral-200)" /> : null}
      {children}
    </Link>
  );
}

/** Lowercase-with-hyphens slug from any text. */
export const slugify = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
