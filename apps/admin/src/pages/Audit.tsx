import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, Loading } from '../components/ui';

const PAGE = 50;

export function AuditPage() {
  const [offset, setOffset] = useState(0);
  const audit = useQuery({ queryKey: ['audit', offset], queryFn: () => api.audit(offset, PAGE) });

  return (
    <>
      <div className="page-head">
        <h1>Audit log</h1>
      </div>
      {audit.isLoading ? (
        <Loading />
      ) : audit.error || !audit.data ? (
        <ErrorBox error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.data.length === 0 ? (
        <Empty>Nothing logged yet.</Empty>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.actorEmail ?? <span className="muted">system or deleted</span>}</td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td className="muted small">
                    {e.entity}
                    {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn small secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Newer
            </button>
            <button type="button" className="btn small secondary" disabled={audit.data.length < PAGE} onClick={() => setOffset(offset + PAGE)}>
              Older
            </button>
          </div>
        </div>
      )}
    </>
  );
}
