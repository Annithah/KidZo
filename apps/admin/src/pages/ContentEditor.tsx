import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  CONTENT_TYPES,
  LOCALES,
  LOCALE_LABELS,
  MAX_AGE,
  MIN_AGE,
  SKILLS,
  SKILL_LABELS,
  contentBodySchema,
  formatBytes,
  estimatePackageBytes,
  type ContentType,
  type Locale,
  type Skill,
} from '@kidzo/shared';
import { api, describeError, type ContentWithProblems } from '../api';
import { BranchingEditor, QuizEditor, SongEditor } from '../components/BodyEditors';
import { ErrorBox, Field, Loading, LocalizedInput, StatusBadge } from '../components/ui';
import { blankDraft, draftFromDetail, liveProblems, withType, type Draft } from '../content-model';

export function ContentEditorPage() {
  const { id } = useParams();
  const existing = useQuery({ queryKey: ['content-item', id], queryFn: () => api.content(id as string), enabled: !!id });
  if (id && existing.isLoading) return <Loading />;
  if (id && (existing.error || !existing.data)) return <ErrorBox error={existing.error} onRetry={() => void existing.refetch()} />;
  return <Editor key={existing.data?.id ?? 'new'} item={existing.data ?? null} />;
}

function Editor({ item }: { item: ContentWithProblems | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stickers = useQuery({ queryKey: ['stickers'], queryFn: api.stickers });
  const [draft, setDraft] = useState<Draft>(() => (item ? draftFromDetail(item) : blankDraft()));
  const [current, setCurrent] = useState<ContentWithProblems | null>(item);
  const [tab, setTab] = useState<'visual' | 'json'>('visual');
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string; problems?: string[] } | null>(null);
  const [dirty, setDirty] = useState(false);

  const problems = useMemo(() => liveProblems(draft), [draft]);
  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const refresh = async (saved: ContentWithProblems) => {
    setCurrent(saved);
    setDirty(false);
    await queryClient.invalidateQueries({ queryKey: ['content'] });
    queryClient.setQueryData(['content-item', saved.id], saved);
  };

  const save = useMutation({
    mutationFn: () => (current ? api.updateContent(current.id, draft) : api.createContent(draft)),
    onSuccess: async (saved) => {
      await refresh(saved);
      setNotice({ tone: 'success', message: `Saved as version ${saved.version}.` });
      if (!current) navigate(`/content/${saved.id}`, { replace: true });
    },
    onError: (e) => setNotice({ tone: 'error', ...describeError(e) }),
  });

  const transition = useMutation({
    mutationFn: async (action: 'publish' | 'unpublish' | 'archive') => {
      if (!current) throw new Error('Save first');
      await api[action](current.id);
      return api.content(current.id);
    },
    onSuccess: async (saved, action) => {
      await refresh(saved);
      setNotice({ tone: 'success', message: action === 'publish' ? 'Published. Families can see it now.' : `Moved to ${saved.status}.` });
    },
    onError: (e) => setNotice({ tone: 'error', ...describeError(e) }),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteContent(current?.id ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      navigate('/content');
    },
    onError: (e) => setNotice({ tone: 'error', ...describeError(e) }),
  });

  const toggle = <T extends string>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="stack">
      <div className="page-head">
        <span className="cover" style={{ background: draft.coverColor, width: 56, height: 56, fontSize: 32 }} aria-hidden>
          {draft.coverEmoji}
        </span>
        <div style={{ flex: 1 }}>
          <p className="kicker" style={{ margin: 0 }}>
            {current ? <StatusBadge status={current.status} /> : 'New'} {current ? `v${current.version}` : ''}
          </p>
          <h1>{draft.title.en || 'Untitled'}</h1>
        </div>
        <button type="button" className="btn" disabled={save.isPending || problems.schema.length > 0} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving...' : dirty || !current ? 'Save' : 'Saved'}
        </button>
        {current && current.status !== 'published' ? (
          <button type="button" className="btn mint" disabled={dirty || problems.publish.length > 0 || transition.isPending} onClick={() => transition.mutate('publish')}>
            Publish
          </button>
        ) : null}
        {current?.status === 'published' ? (
          <button type="button" className="btn secondary" disabled={transition.isPending} onClick={() => transition.mutate('unpublish')}>
            Unpublish
          </button>
        ) : null}
        {current && current.status !== 'archived' ? (
          <button type="button" className="btn secondary" disabled={transition.isPending} onClick={() => transition.mutate('archive')}>
            Archive
          </button>
        ) : null}
        {current && current.status !== 'published' ? (
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (window.confirm('Delete this content permanently?')) remove.mutate();
            }}
          >
            Delete
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className={`alert ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.message}
          {notice.problems?.length ? (
            <ul>
              {notice.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {problems.schema.length > 0 || problems.publish.length > 0 ? (
        <div className="alert info">
          {problems.schema.length > 0 ? 'Fix these before saving:' : 'Saved drafts are fine, but fix these before publishing:'}
          <ul>
            {[...problems.schema, ...problems.publish].slice(0, 12).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="alert success">Ready to publish.</div>
      )}
      {dirty && current?.status === 'published' ? <div className="alert info">This content is live. Saving updates it for families immediately.</div> : null}

      <div className="card stack">
        <h2>Details</h2>
        <div className="grid two">
          <Field label="Type">
            <select className="input" value={draft.type} onChange={(e) => {
              setDraft((d) => withType(d, e.target.value as ContentType));
              setDirty(true);
            }}>
              {CONTENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Slug" hint="Used in links. lowercase-words-with-hyphens">
            <input className="input" value={draft.slug} onChange={(e) => update({ slug: e.target.value })} />
          </Field>
        </div>
        <LocalizedInput label="Title" value={draft.title} onChange={(title) => update({ title })} />
        <LocalizedInput label="Summary" multiline value={draft.summary} onChange={(summary) => update({ summary })} />
        <div className="row">
          <Field label="Min age">
            <input className="input" type="number" min={MIN_AGE} max={MAX_AGE} value={draft.ageMin} onChange={(e) => update({ ageMin: Number(e.target.value) })} />
          </Field>
          <Field label="Max age">
            <input className="input" type="number" min={MIN_AGE} max={MAX_AGE} value={draft.ageMax} onChange={(e) => update({ ageMax: Number(e.target.value) })} />
          </Field>
          <Field label="Minutes">
            <input className="input" type="number" min={1} max={120} value={draft.durationMinutes} onChange={(e) => update({ durationMinutes: Number(e.target.value) })} />
          </Field>
          <Field label="Reward stars">
            <input className="input" type="number" min={0} max={100} value={draft.rewardStars} onChange={(e) => update({ rewardStars: Number(e.target.value) })} />
          </Field>
          <Field label="Reward sticker">
            <select className="input" value={draft.rewardStickerId ?? ''} onChange={(e) => update({ rewardStickerId: e.target.value || null })}>
              <option value="">None</option>
              {(stickers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name.en}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row">
          <Field label="Cover emoji">
            <input className="input" style={{ width: 100 }} value={draft.coverEmoji} onChange={(e) => update({ coverEmoji: e.target.value })} />
          </Field>
          <Field label="Cover color">
            <input className="input" type="color" style={{ width: 90, height: 44, padding: 4 }} value={draft.coverColor} onChange={(e) => update({ coverColor: e.target.value.toUpperCase() })} />
          </Field>
          <label className="checkbox">
            <input type="checkbox" checked={draft.calm} disabled={draft.type === 'game'} onChange={(e) => update({ calm: e.target.checked })} />
            🌙 Calm (allowed at bedtime)
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={draft.featured} onChange={(e) => update({ featured: e.target.checked })} />
            ⭐ Featured
          </label>
        </div>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 800 }}>Skills (1 to 4)</legend>
          <div className="row">
            {SKILLS.map((s: Skill) => (
              <label key={s} className="checkbox">
                <input type="checkbox" checked={draft.skills.includes(s)} onChange={() => update({ skills: toggle(draft.skills, s) })} />
                {SKILL_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 800 }}>Available in (every text needs a translation for each language)</legend>
          <div className="row">
            {LOCALES.map((l: Locale) => (
              <label key={l} className="checkbox">
                <input type="checkbox" checked={draft.languages.includes(l)} disabled={l === 'en'} onChange={() => update({ languages: toggle(draft.languages, l) })} />
                {LOCALE_LABELS[l].native}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 style={{ flex: 1 }}>{draft.body.kind === 'branching' ? 'Story scenes' : draft.body.kind === 'quiz' ? 'Questions' : 'Lyrics'}</h2>
          <span className="muted small">Download size about {formatBytes(estimatePackageBytes(draft.body))}</span>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'visual'} className={`tab ${tab === 'visual' ? 'active' : ''}`} onClick={() => setTab('visual')}>
            Visual editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'json'}
            className={`tab ${tab === 'json' ? 'active' : ''}`}
            onClick={() => {
              setJson(JSON.stringify(draft.body, null, 2));
              setJsonError(null);
              setTab('json');
            }}
          >
            JSON
          </button>
        </div>
        {tab === 'json' ? (
          <div className="stack">
            <textarea className="input" style={{ minHeight: 420, fontFamily: 'monospace', fontSize: 13 }} value={json} onChange={(e) => setJson(e.target.value)} aria-label="Body JSON" />
            {jsonError ? <div className="alert error">{jsonError}</div> : null}
            <button
              type="button"
              className="btn sky small"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                try {
                  const parsed = contentBodySchema.safeParse(JSON.parse(json));
                  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
                  update({ body: parsed.data });
                  setJsonError(null);
                  setTab('visual');
                } catch (err) {
                  setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
                }
              }}
            >
              Apply JSON
            </button>
          </div>
        ) : draft.body.kind === 'branching' ? (
          <BranchingEditor body={draft.body} onChange={(body) => update({ body })} />
        ) : draft.body.kind === 'quiz' ? (
          <QuizEditor body={draft.body} onChange={(body) => update({ body })} />
        ) : (
          <SongEditor body={draft.body} onChange={(body) => update({ body })} />
        )}
      </div>
    </div>
  );
}
