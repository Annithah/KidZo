import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ACTIONS, ACTIONS_FOR, STATUS_LABEL, canDelete, type WorkflowAction } from '../workflow';
import { AGE_GROUP_RULES, CONTENT_STATUSES, ageRangeLabel, formatBytes, type ContentStatus, type ContentSummary, type ContentType } from '@kidzo/shared';
import { CONTENT_TYPE_WORLD } from '@kidzo/ui-tokens';
import { api, describeError } from '../api';
import { Art } from '../components/Art';
import { DataTable } from '../components/DataTable';
import { ConfirmDialog, OverflowMenu, useToast } from '../components/feedback';
import { Icon } from '../components/Icon';
import { ButtonLink, ErrorBox, Loading, PageHeader, StatusBadge } from '../components/ui';

const VIEWS = {
  all: { title: 'Content', types: null as ContentType[] | null, description: 'Every adventure, story, song and game.' },
  stories: { title: 'Stories', types: ['adventure', 'story'] as ContentType[], description: 'Branching adventures and read-along stories.' },
  games: { title: 'Games', types: ['game'] as ContentType[], description: 'Quizzes and brain games.' },
};

export function ContentListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const viewKey = (params.get('view') as keyof typeof VIEWS | null) ?? 'all';
  const view = VIEWS[viewKey] ?? VIEWS.all;
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [deleting, setDeleting] = useState<ContentSummary | null>(null);
  const q = params.get('q') ?? '';

  const query = useQuery({
    queryKey: ['content', status, q],
    queryFn: () => api.contentList({ ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteContent(id),
    onSuccess: async () => {
      setDeleting(null);
      toast('success', 'Content deleted.');
      await queryClient.invalidateQueries({ queryKey: ['content'] });
    },
    onError: (e) => toast('error', describeError(e).message),
  });
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: WorkflowAction }) => api[action](id),
    onSuccess: async (_r, v) => {
      toast('success', ACTIONS[v.action].toast);
      await queryClient.invalidateQueries({ queryKey: ['content'] });
    },
    onError: (e) => toast('error', describeError(e).message),
  });

  const rows = (query.data?.items ?? []).filter((c) => !view.types || view.types.includes(c.type));

  return (
    <>
      <PageHeader kicker="Library" title={view.title} description={view.description} actions={<ButtonLink to="/content/new" icon="plus">New content</ButtonLink>} />
      {q ? (
        <div className="alert info" style={{ marginBottom: 16 }}>
          <Icon name="search" size={18} />
          <span style={{ flex: 1 }}>Showing results for &ldquo;{q}&rdquo;</span>
          <button type="button" className="btn ghost small" onClick={() => setParams((p) => (p.delete('q'), p))}>
            Clear search
          </button>
        </div>
      ) : null}
      {query.isLoading ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption={`${view.title} list`}
          rows={rows}
          rowKey={(c) => c.id}
          searchText={(c) => `${c.title.en} ${c.slug}`}
          searchLabel="Filter by title or slug"
          initialSort={{ key: 'updated', dir: 'desc' }}
          empty={{ title: 'No content matches', body: 'Try another filter, or create something new.' }}
          tools={
            <div className="row" role="group" aria-label="Status">
              {(['', ...CONTENT_STATUSES] as const).map((s) => (
                <button key={s || 'all'} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s ? STATUS_LABEL[s] : 'All'}
                </button>
              ))}
            </div>
          }
          columns={[
            {
              key: 'title',
              header: 'Title',
              sort: (c) => c.title.en,
              render: (c) => (
                <div className="cell-title">
                  <span className="art-swatch" style={{ width: 44, height: 44, background: `var(--${CONTENT_TYPE_WORLD[c.type] ?? 'sky'}-50)` }}>
                    <Art art={c.coverArt} size={38} />
                  </span>
                  <div>
                    <Link to={`/content/${c.id}`}>{c.title.en}</Link>
                    <div className="muted small row" style={{ gap: 8 }}>
                      {c.slug}
                      {c.calm ? (
                        <span className="badge neutral">
                          <Icon name="bedtime" size={12} />
                          Calm
                        </span>
                      ) : null}
                      {c.featured ? (
                        <span className="badge neutral">
                          <Icon name="star" size={12} />
                          Featured
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ),
            },
            { key: 'type', header: 'Type', sort: (c) => c.type, render: (c) => <span style={{ textTransform: 'capitalize' }}>{c.type}</span> },
            { key: 'ages', header: 'Ages', sort: (c) => c.ageMin, render: (c) => ageRangeLabel(c.ageMin, c.ageMax) },
            {
              key: 'groups',
              header: 'Age groups',
              render: (c) => (
                <span className="row" style={{ gap: 4 }}>
                  {c.ageGroups.map((g) => (
                    <span key={g} className="badge neutral" title={AGE_GROUP_RULES[g].label}>
                      {AGE_GROUP_RULES[g].label.split(' ')[0]}
                    </span>
                  ))}
                </span>
              ),
            },
            { key: 'langs', header: 'Languages', render: (c) => c.languages.map((l) => l.toUpperCase()).join(', ') },
            { key: 'size', header: 'Size', numeric: true, sort: (c) => c.sizeBytes, render: (c) => formatBytes(c.sizeBytes) },
            { key: 'status', header: 'Status', sort: (c) => c.status, render: (c) => <StatusBadge status={c.status} /> },
            { key: 'updated', header: 'Updated', sort: (c) => c.updatedAt, render: (c) => <span className="small muted">{new Date(c.updatedAt).toLocaleDateString()}</span> },
            {
              key: 'actions',
              header: '',
              className: 'actions',
              render: (c) => (
                <OverflowMenu
                  label={`Actions for ${c.title.en}`}
                  items={[
                    { label: 'Edit', icon: 'edit', onSelect: () => navigate(`/content/${c.id}`) },
                    ...ACTIONS_FOR[c.status].map((action) => ({ label: ACTIONS[action].label, icon: ACTIONS[action].icon, onSelect: () => transition.mutate({ id: c.id, action }) })),
                    ...(canDelete(c.status) ? (['divider', { label: 'Delete', icon: 'delete' as const, danger: true, onSelect: () => setDeleting(c) }] as const) : []),
                  ]}
                />
              ),
            },
          ]}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete content?"
        message={`"${deleting?.title.en ?? ''}" will be removed permanently. This cannot be undone.`}
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
