import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { stickerInputSchema, type LocalizedText, type Sticker } from '@kidzo/shared';
import { api, describeError } from '../api';
import { Empty, ErrorBox, Field, Loading, LocalizedInput } from '../components/ui';

const blank = { slug: '', name: { en: '' } as LocalizedText, emoji: '⭐', color: '#FFD23F' };

export function StickersPage() {
  const queryClient = useQueryClient();
  const stickers = useQuery({ queryKey: ['stickers'], queryFn: api.stickers });
  const [editing, setEditing] = useState<Sticker | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = stickerInputSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      return editing ? api.updateSticker(editing.id, parsed.data) : api.createSticker(parsed.data);
    },
    onSuccess: () => {
      setEditing(null);
      setForm(blank);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['stickers'] });
    },
    onError: (e) => setError(describeError(e).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSticker(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['stickers'] }),
    onError: (e) => setError(describeError(e).message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <>
      <div className="page-head">
        <h1>Stickers</h1>
      </div>
      <div className="grid two">
        <form className="card stack" onSubmit={submit}>
          <h2>{editing ? `Edit ${editing.name.en}` : 'New sticker'}</h2>
          <Field label="Slug" hint="lowercase-words-with-hyphens">
            <input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <LocalizedInput label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <div className="row">
            <Field label="Emoji">
              <input className="input" style={{ width: 100 }} value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
            </Field>
            <Field label="Color">
              <input className="input" style={{ width: 120, padding: 4, height: 44 }} type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} />
            </Field>
            <span className="cover" style={{ background: form.color, width: 64, height: 64, fontSize: 34 }} aria-hidden>
              {form.emoji}
            </span>
          </div>
          {error ? <div className="alert error">{error}</div> : null}
          <div className="row">
            <button type="submit" className="btn" disabled={save.isPending}>
              {editing ? 'Save sticker' : 'Create sticker'}
            </button>
            {editing ? (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(blank);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="card">
          {stickers.isLoading ? (
            <Loading />
          ) : stickers.error || !stickers.data ? (
            <ErrorBox error={stickers.error} onRetry={() => void stickers.refetch()} />
          ) : stickers.data.length === 0 ? (
            <Empty>No stickers yet.</Empty>
          ) : (
            <table>
              <tbody>
                {stickers.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="cover" style={{ background: s.color }}>
                        {s.emoji}
                      </span>
                    </td>
                    <td>
                      <strong>{s.name.en}</strong>
                      <div className="muted small">{s.slug}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => {
                          setEditing(s);
                          setForm({ slug: s.slug, name: s.name, emoji: s.emoji, color: s.color });
                        }}
                      >
                        Edit
                      </button>{' '}
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => {
                          if (window.confirm(`Delete sticker "${s.name.en}"? Children lose it from their album.`)) remove.mutate(s.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
