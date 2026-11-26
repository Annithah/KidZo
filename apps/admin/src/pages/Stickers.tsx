import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getArt } from '@kidzo/art';
import { stickerInputSchema, type LocalizedText, type Sticker } from '@kidzo/shared';
import { palette, type ColorName } from '@kidzo/ui-tokens';
import { api, describeError } from '../api';
import { Art } from '../components/Art';
import { ArtPicker } from '../components/ArtPicker';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog, OverflowMenu, useToast } from '../components/feedback';
import { Button, ErrorBox, Field, Loading, LocalizedInput, PageHeader, slugify } from '../components/ui';
import { useFormErrors } from '../form';

type Form = { slug: string; name: LocalizedText; art: string; color: string };
const DEFAULT_ART = 'sticker.counting-star';
const blank = (): Form => ({ slug: '', name: { en: '' }, art: DEFAULT_ART, color: palette.star[200] });

function StickerPreview({ art, color, size = 72, locked }: { art: string; color: string; size?: number; locked?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--paper-500)',
        padding: size * 0.06,
        boxShadow: locked ? 'none' : 'var(--shadow-coral-2)',
        display: 'inline-grid',
        flex: 'none',
      }}
    >
      <span style={{ borderRadius: '50%', background: locked ? 'var(--navy-50)' : color, display: 'grid', placeItems: 'center' }}>
        <Art art={art} size={size * 0.84} silhouette={locked} />
      </span>
    </span>
  );
}

export function StickersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const stickers = useQuery({ queryKey: ['stickers'], queryFn: api.stickers });
  const [editing, setEditing] = useState<Sticker | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<Sticker | null>(null);
  const v = useFormErrors(stickerInputSchema, form);

  const startNew = () => {
    setEditing(null);
    setForm(blank());
    setSlugTouched(false);
    v.reset();
  };

  const save = useMutation({
    mutationFn: async () => {
      const data = stickerInputSchema.parse(form);
      return editing ? api.updateSticker(editing.id, data) : api.createSticker(data);
    },
    onSuccess: (saved) => {
      toast('success', editing ? `Saved "${saved.name.en}".` : `Created "${saved.name.en}".`);
      startNew();
      void queryClient.invalidateQueries({ queryKey: ['stickers'] });
    },
    onError: (e) => {
      if (!v.fromServer(e)) toast('error', describeError(e).message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSticker(id),
    onSuccess: () => {
      toast('success', 'Sticker deleted.');
      setDeleting(null);
      if (deleting && editing?.id === deleting.id) startNew();
      void queryClient.invalidateQueries({ queryKey: ['stickers'] });
    },
    onError: (e) => toast('error', describeError(e).message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (v.attempt()) save.mutate();
  };

  const pickArt = (art: string) => {
    const world = (getArt(art).world ?? 'star') as ColorName;
    setForm((f) => ({ ...f, art, color: f.color === palette[(getArt(f.art).world ?? 'star') as ColorName]?.[200] ? (palette[world]?.[200] ?? f.color) : f.color }));
  };

  return (
    <>
      <PageHeader kicker="Library" title="Stickers" description="Rewards children collect in their album." actions={editing ? <Button tone="secondary" icon="plus" onClick={startNew}>New sticker</Button> : undefined} />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <form className="card stack" onSubmit={submit} noValidate aria-labelledby="sticker-form">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2 id="sticker-form">{editing ? `Edit ${editing.name.en}` : 'New sticker'}</h2>
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 20 }}>
            <StickerPreview art={form.art} color={form.color} size={96} />
            <StickerPreview art={form.art} color={form.color} size={56} locked />
            <span className="muted small">Unlocked and locked previews</span>
          </div>
          <LocalizedInput
            label="Name"
            path="name"
            errors={v.errors}
            value={form.name}
            onBlur={(lang) => v.blur(`name.${lang}`)}
            onChange={(name) => setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name.en ?? '') }))}
          />
          <Field label="Slug" hint="Made from the English name. Lowercase words with hyphens." error={v.errors.slug}>
            {(a11y) => (
              <input
                {...a11y}
                className="input"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                onBlur={() => v.blur('slug')}
              />
            )}
          </Field>
          <div className="grid form">
            <Field label="Art" error={v.errors.art}>
              {(a11y) => <ArtPicker id={a11y.id} invalid={a11y['aria-invalid']} label="Choose sticker art" value={form.art} color={form.color} groups={['sticker', 'object']} onChange={pickArt} />}
            </Field>
            <Field label="Color" error={v.errors.color}>
              {(a11y) => <input {...a11y} className="input color" type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value.toUpperCase() }))} />}
            </Field>
          </div>
          <div className="form-actions">
            {editing ? (
              <Button tone="secondary" onClick={startNew}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" icon="check" busy={save.isPending}>
              {editing ? 'Save sticker' : 'Create sticker'}
            </Button>
          </div>
        </form>

        {stickers.isLoading ? (
          <Loading />
        ) : stickers.error || !stickers.data ? (
          <ErrorBox error={stickers.error} onRetry={() => void stickers.refetch()} />
        ) : (
          <DataTable
            caption="Stickers"
            rows={stickers.data}
            rowKey={(s) => s.id}
            searchText={(s) => `${s.name.en} ${s.slug}`}
            searchLabel="Search stickers"
            pageSize={12}
            initialSort={{ key: 'name', dir: 'asc' }}
            empty={{ title: 'No stickers yet', body: 'Create the first reward on the left.' }}
            columns={[
              {
                key: 'name',
                header: 'Sticker',
                sort: (s) => s.name.en,
                render: (s) => (
                  <div className="cell-title">
                    <StickerPreview art={s.art} color={s.color} size={44} />
                    <div>
                      <strong>{s.name.en}</strong>
                      <div className="muted small">{s.slug}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'actions',
                render: (s) => (
                  <OverflowMenu
                    label={`Actions for ${s.name.en}`}
                    items={[
                      {
                        label: 'Edit',
                        icon: 'edit',
                        onSelect: () => {
                          setEditing(s);
                          setForm({ slug: s.slug, name: s.name, art: s.art, color: s.color });
                          setSlugTouched(true);
                          v.reset();
                        },
                      },
                      'divider',
                      { label: 'Delete', icon: 'delete', danger: true, onSelect: () => setDeleting(s) },
                    ]}
                  />
                ),
              },
            ]}
          />
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        title="Delete sticker?"
        message={`Children who earned "${deleting?.name.en ?? ''}" will lose it from their album. This cannot be undone.`}
        confirmLabel="Delete sticker"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
