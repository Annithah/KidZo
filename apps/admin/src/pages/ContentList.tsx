import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CONTENT_STATUSES, CONTENT_TYPES, ageRangeLabel, formatBytes, type ContentStatus, type ContentType } from '@kidzo/shared';
import { api } from '../api';
import { Empty, ErrorBox, Loading, StatusBadge } from '../components/ui';

export function ContentListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [type, setType] = useState<ContentType | ''>('');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['content', status, type, q],
    queryFn: () => api.contentList({ ...(status ? { status } : {}), ...(type ? { type } : {}), ...(q.trim() ? { q: q.trim() } : {}) }),
  });

  return (
    <>
      <div className="page-head">
        <h1>Content</h1>
        <Link to="/content/new" className="btn">
          + New content
        </Link>
      </div>
      <div className="card row" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search titles" aria-label="Search titles" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ maxWidth: 180 }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as ContentStatus | '')}>
          <option value="">All statuses</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 180 }} aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ContentType | '')}>
          <option value="">All types</option>
          {CONTENT_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Empty>No content matches these filters.</Empty>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th />
                <th>Title</th>
                <th>Type</th>
                <th>Ages</th>
                <th>Languages</th>
                <th>Size</th>
                <th>Status</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/content/${c.id}`)}>
                  <td>
                    <span className="cover" style={{ background: c.coverColor }}>
                      {c.coverEmoji}
                    </span>
                  </td>
                  <td>
                    <Link to={`/content/${c.id}`} onClick={(e) => e.stopPropagation()}>
                      <strong>{c.title.en}</strong>
                    </Link>
                    <div className="muted small">
                      {c.slug}
                      {c.calm ? ' · 🌙 calm' : ''}
                      {c.featured ? ' · ⭐ featured' : ''}
                    </div>
                  </td>
                  <td>{c.type}</td>
                  <td>{ageRangeLabel(c.ageMin, c.ageMax)}</td>
                  <td>{c.languages.map((l) => l.toUpperCase()).join(', ')}</td>
                  <td>{formatBytes(c.sizeBytes)}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>v{c.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">{query.data.total} items</p>
        </div>
      )}
    </>
  );
}
