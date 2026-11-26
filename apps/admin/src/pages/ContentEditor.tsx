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
  contentInputSchema,
  estimatePackageBytes,
  formatBytes,
  friendlyFieldErrors,
  publishProblems,
  type ContentType,
  type Locale,
  type Skill,
  AGE_GROUPS,
  AGE_GROUP_RULES,
} from '@kidzo/shared';
import { api, describeError, type ContentWithProblems } from '../api';
import { ArtPicker } from '../components/ArtPicker';
import { BranchingEditor, QuizEditor, SongEditor, VideoEditor } from '../components/BodyEditors';
import { BranchingPreview } from '../components/BranchingPreview';
import { ConfirmDialog, useToast } from '../components/feedback';
import { Art } from '../components/Art';
import { Icon } from '../components/Icon';
import { Button, ErrorBox, Field, Loading, LocalizedInput, StatusBadge, slugify } from '../components/ui';
import { blankDraft, draftFromDetail, withType, type Draft } from '../content-model';
import { useFormErrors } from '../form';
import { ACTIONS, ACTIONS_FOR, canDelete, type WorkflowAction } from '../workflow';

export function ContentEditorPage() {
  const { id } = useParams();
  const existing = useQuery({ queryKey: ['content-item', id], queryFn: () => api.content(id as string), enabled: !!id });
  if (id && existing.isLoading) return <Loading />;
  if (id && (existing.error || !existing.data)) return <ErrorBox error={existing.error} onRetry={() => void existing.refetch()} />;
  return <Editor key={existing.data?.id ?? 'new'} item={existing.data ?? null} />;
}

const TYPE_ICON = { adventure: 'adventure', story: 'story', song: 'song', game: 'game', video: 'video' } as const;

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-intro">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="stack">{children}</div>
    </div>
  );
}

function Editor({ item }: { item: ContentWithProblems | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const stickers = useQuery({ queryKey: ['stickers'], queryFn: api.stickers });
  const [draft, setDraft] = useState<Draft>(() => (item ? draftFromDetail(item) : blankDraft()));
  const [current, setCurrent] = useState<ContentWithProblems | null>(item);
  const [slugTouched, setSlugTouched] = useState(!!item);
  const [tab, setTab] = useState<'visual' | 'json'>('visual');
  const [json, setJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useFormErrors(contentInputSchema, draft);

  const blockers = useMemo(() => {
    const parsed = contentInputSchema.safeParse(draft);
    return parsed.success ? publishProblems(parsed.data) : [];
  }, [draft]);

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
      toast('success', `Saved as version ${saved.version}.`);
      if (!current) navigate(`/content/${saved.id}`, { replace: true });
    },
    onError: (e) => {
      if (form.fromServer(e)) toast('error', 'Some fields need attention.');
      else toast('error', describeError(e).message);
    },
  });

  const transition = useMutation({
    mutationFn: async (action: WorkflowAction) => {
      if (!current) throw new Error('Save first');
      await api[action](current.id);
      return api.content(current.id);
    },
    onSuccess: async (saved, action) => {
      await refresh(saved);
      toast('success', ACTIONS[action].toast);
    },
    onError: (e) => toast('error', describeError(e).message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteContent(current?.id ?? ''),
    onSuccess: async () => {
      toast('success', 'Content deleted.');
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      navigate('/content');
    },
    onError: (e) => toast('error', describeError(e).message),
  });

  const trySave = () => {
    if (form.attempt()) save.mutate();
    else toast('error', 'Some fields need attention. Look for the red messages.');
  };

  const toggle = <T extends string>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const errors = form.errors;
  const errorCount = Object.keys(form.allErrors).length;

  return (
    <div className="stack">
      <div className="page-head">
        <span className="art-swatch" style={{ background: draft.coverColor, width: 64, height: 64, borderRadius: 'var(--radius-md)' }} aria-hidden>
          <Art art={draft.coverArt} size={56} />
        </span>
        <div className="titles">
          <p className="kicker row" style={{ gap: 8 }}>
            {current ? <StatusBadge status={current.status} /> : 'New'} {current ? `Version ${current.version}` : null}
          </p>
          <h1>{draft.title.en || 'Untitled'}</h1>
        </div>
        <div className="row">
          {current
            ? ACTIONS_FOR[current.status].map((action) => {
                const info = ACTIONS[action];
                // Moving forward needs saved, valid content; side steps (archive, send back) do not.
                const needsReady = action === 'submit' || action === 'publish';
                return (
                  <Button
                    key={action}
                    tone={info.primary ? 'mint' : 'secondary'}
                    icon={info.icon}
                    disabled={transition.isPending || (needsReady && (dirty || blockers.length > 0 || errorCount > 0))}
                    busy={transition.isPending && transition.variables === action}
                    onClick={() => transition.mutate(action)}
                  >
                    {info.label}
                  </Button>
                );
              })
            : null}
          {current && canDelete(current.status) ? (
            <Button tone="ghost" icon="delete" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
          <Button icon="check" busy={save.isPending} disabled={!dirty && !!current} onClick={trySave}>
            {dirty || !current ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      {dirty && current?.status === 'published' ? (
        <div className="alert warning">
          <Icon name="info" size={18} />
          This content is live. Saving updates it for families immediately.
        </div>
      ) : null}
      {errorCount === 0 && blockers.length > 0 ? (
        <div className="alert info" role="status">
          <Icon name="info" size={18} />
          <div>
            Drafts can be saved, but these need fixing before publishing:
            <ul>
              {blockers.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : errorCount === 0 ? (
        <div className="alert success" role="status">
          <Icon name="checkCircle" size={18} />
          {current?.status === 'draft' ? 'Ready to send for review.' : 'Ready to publish.'}
        </div>
      ) : null}

      <div className="card">
        <Section title="Basics" description="What it is and how families find it.">
          <div className="grid form">
            <Field label="Type">
              {(a11y) => (
                <select
                  {...a11y}
                  className="input"
                  value={draft.type}
                  onChange={(e) => {
                    setDraft((d) => withType(d, e.target.value as ContentType));
                    setDirty(true);
                  }}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t[0]!.toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Slug" hint="Made from the English title. Used in links." error={errors.slug}>
              {(a11y) => (
                <input
                  {...a11y}
                  className="input"
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update({ slug: e.target.value });
                  }}
                  onBlur={() => form.blur('slug')}
                />
              )}
            </Field>
          </div>
          <LocalizedInput
            label="Title"
            path="title"
            errors={errors}
            languages={draft.languages}
            value={draft.title}
            onBlur={(l) => form.blur(`title.${l}`)}
            onChange={(title) => update({ title, ...(slugTouched ? {} : { slug: slugify(title.en ?? '') }) })}
          />
          <LocalizedInput label="Summary" path="summary" errors={errors} languages={draft.languages} multiline value={draft.summary} onBlur={(l) => form.blur(`summary.${l}`)} onChange={(summary) => update({ summary })} />
        </Section>

        <Section title="Audience" description="Who it is for and which languages it is ready in.">
          <div className="grid form">
            <Field label="Youngest age" error={errors.ageMin}>
              {(a11y) => <input {...a11y} className="input" type="number" min={MIN_AGE} max={MAX_AGE} value={draft.ageMin} onBlur={() => form.blur('ageMin')} onChange={(e) => update({ ageMin: Number(e.target.value) })} />}
            </Field>
            <Field label="Oldest age" error={errors.ageMax}>
              {(a11y) => <input {...a11y} className="input" type="number" min={MIN_AGE} max={MAX_AGE} value={draft.ageMax} onBlur={() => form.blur('ageMax')} onChange={(e) => update({ ageMax: Number(e.target.value) })} />}
            </Field>
            <Field label="Length in minutes" error={errors.durationMinutes}>
              {(a11y) => <input {...a11y} className="input" type="number" min={1} max={120} value={draft.durationMinutes} onBlur={() => form.blur('durationMinutes')} onChange={(e) => update({ durationMinutes: Number(e.target.value) })} />}
            </Field>
          </div>
          <fieldset className="stack tight">
            <legend className="small" style={{ fontWeight: 700 }}>Age groups</legend>
            <p className="muted small" style={{ margin: 0 }}>Children only receive content tagged for their group. Leave all off to use the age range.</p>
            <div className="row">
              {AGE_GROUPS.map((g) => (
                <label key={g} className="checkbox">
                  <input type="checkbox" checked={(draft.ageGroups ?? []).includes(g)} onChange={() => update({ ageGroups: toggle(draft.ageGroups ?? [], g) })} />
                  {AGE_GROUP_RULES[g].label} ({AGE_GROUP_RULES[g].minAge} to {AGE_GROUP_RULES[g].maxAge})
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="stack tight">
            <legend>Skills (1 to 4)</legend>
            <div className="checks">
              {SKILLS.map((s: Skill) => (
                <label key={s} className="checkbox">
                  <input type="checkbox" checked={draft.skills.includes(s)} onChange={() => update({ skills: toggle(draft.skills, s) })} onBlur={() => form.blur('skills')} />
                  {SKILL_LABELS[s]}
                </label>
              ))}
            </div>
            {errors.skills ? (
              <span className="field-error" role="alert">
                <Icon name="warning" size={14} />
                {errors.skills}
              </span>
            ) : null}
          </fieldset>
          <fieldset className="stack tight">
            <legend>Languages</legend>
            <p className="muted small">Every text needs a translation for each language you tick.</p>
            <div className="checks">
              {LOCALES.map((l: Locale) => (
                <label key={l} className="checkbox">
                  <input type="checkbox" checked={draft.languages.includes(l)} disabled={l === 'en'} onChange={() => update({ languages: toggle(draft.languages, l) })} />
                  {LOCALE_LABELS[l].native}
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title="Look and rewards" description="Cover picture, color and what children earn.">
          <div className="grid form">
            <Field label="Cover picture" error={errors.coverArt}>
              {(a11y) => <ArtPicker id={a11y.id} invalid={a11y['aria-invalid']} label="Choose a cover picture" value={draft.coverArt} color={draft.coverColor} groups={['object', 'category', 'zo', 'scene']} onChange={(coverArt) => update({ coverArt })} />}
            </Field>
            <Field label="Cover color" error={errors.coverColor}>
              {(a11y) => <input {...a11y} className="input color" type="color" value={draft.coverColor} onChange={(e) => update({ coverColor: e.target.value.toUpperCase() })} />}
            </Field>
            <Field label="Reward stars" error={errors.rewardStars}>
              {(a11y) => <input {...a11y} className="input" type="number" min={0} max={100} value={draft.rewardStars} onBlur={() => form.blur('rewardStars')} onChange={(e) => update({ rewardStars: Number(e.target.value) })} />}
            </Field>
            <Field label="Reward sticker">
              {(a11y) => (
                <select {...a11y} className="input" value={draft.rewardStickerId ?? ''} onChange={(e) => update({ rewardStickerId: e.target.value || null })}>
                  <option value="">None</option>
                  {(stickers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name.en}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="checks">
            <label className="checkbox">
              <input type="checkbox" checked={draft.calm} disabled={draft.type === 'game'} onChange={(e) => update({ calm: e.target.checked })} />
              <Icon name="bedtime" size={16} />
              Calm, allowed at bedtime
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={draft.featured} onChange={(e) => update({ featured: e.target.checked })} />
              <Icon name="star" size={16} />
              Featured
            </label>
          </div>
          {errors.calm ? (
            <span className="field-error" role="alert">
              <Icon name="warning" size={14} />
              {errors.calm}
            </span>
          ) : null}
        </Section>
      </div>

      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <Icon name={TYPE_ICON[draft.type]} size={24} />
          <h2>{draft.body.kind === 'branching' ? 'Story scenes' : draft.body.kind === 'quiz' ? 'Questions' : draft.body.kind === 'video' ? 'Video and quiz' : 'Lyrics'}</h2>
          <span className="muted small">Download size about {formatBytes(estimatePackageBytes(draft.body))}</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Editor mode">
          <button type="button" role="tab" aria-selected={tab === 'visual'} className={`tab ${tab === 'visual' ? 'active' : ''}`} onClick={() => setTab('visual')}>
            <Icon name="scene" size={16} />
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
            <Icon name="link" size={16} />
            JSON
          </button>
        </div>
        {tab === 'json' ? (
          <div className="stack">
            <textarea className="input" style={{ minHeight: 420, fontFamily: 'var(--font-mono)', fontSize: 13 }} value={json} onChange={(e) => setJson(e.target.value)} aria-label="Body JSON" aria-invalid={!!jsonError} />
            {jsonError ? (
              <div className="alert error" role="alert">
                <Icon name="warning" size={18} />
                {jsonError}
              </div>
            ) : null}
            <Button
              tone="secondary"
              small
              icon="check"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                try {
                  const parsed = contentBodySchema.safeParse(JSON.parse(json));
                  if (!parsed.success) {
                    const first = Object.entries(friendlyFieldErrors(parsed.error.issues))[0];
                    throw new Error(first ? `${first[0]}: ${first[1]}` : 'Check the JSON');
                  }
                  update({ body: parsed.data });
                  setJsonError(null);
                  setTab('visual');
                } catch (err) {
                  setJsonError(err instanceof SyntaxError ? 'That is not valid JSON. Check for missing commas or quotes.' : err instanceof Error ? err.message : 'Check the JSON');
                }
              }}
            >
              Apply JSON
            </Button>
          </div>
        ) : draft.body.kind === 'branching' ? (
          <BranchingEditor body={draft.body} errors={errors} onBlur={form.blur} onChange={(body) => update({ body })} />
        ) : draft.body.kind === 'quiz' ? (
          <QuizEditor body={draft.body} errors={errors} onBlur={form.blur} onChange={(body) => update({ body })} />
        ) : draft.body.kind === 'video' ? (
          <VideoEditor body={draft.body} errors={errors} onBlur={form.blur} onChange={(body) => update({ body })} />
        ) : (
          <SongEditor body={draft.body} errors={errors} onBlur={form.blur} onChange={(body) => update({ body })} />
        )}
        {draft.body.kind === 'branching' && tab === 'visual' ? (
          <BranchingPreview body={draft.body} />
        ) : null}
      </div>

      <div className="form-actions" style={{ borderTop: 0 }}>
        <Button tone="secondary" onClick={() => navigate('/content')}>
          Back to content
        </Button>
        <Button icon="check" busy={save.isPending} disabled={!dirty && !!current} onClick={trySave}>
          {dirty || !current ? 'Save' : 'Saved'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this content?"
        message={`"${draft.title.en || 'Untitled'}" will be removed permanently. This cannot be undone.`}
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
