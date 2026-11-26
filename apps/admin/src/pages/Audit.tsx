import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { DataTable } from '../components/DataTable';
import { Button, ErrorBox, Loading, PageHeader } from '../components/ui';

const PAGE = 100;

export function AuditPage() {
  const [offset, setOffset] = useState(0);
  const [entity, setEntity] = useState('');
  const audit = useQuery({ queryKey: ['audit', offset, PAGE], queryFn: () => api.audit(offset, PAGE) });
  const entities = [...new Set((audit.data ?? []).map((e) => e.entity))].sort();
  const rows = (audit.data ?? []).filter((e) => !entity || e.entity === entity);

  return (
    <>
      <PageHeader kicker="People" title="Audit log" description="Sensitive actions, newest first." />
      {audit.isLoading ? (
        <Loading />
      ) : audit.error || !audit.data ? (
        <ErrorBox error={audit.error} onRetry={() => void audit.refetch()} />
      ) : (
        <div className="stack">
          <DataTable
            caption="Audit log entries"
            rows={rows}
            rowKey={(e) => e.id}
            searchText={(e) => `${e.action} ${e.actorEmail ?? ''} ${e.entity}`}
            searchLabel="Search actions and people"
            initialSort={{ key: 'when', dir: 'desc' }}
            empty={{ title: 'Nothing logged yet' }}
            tools={
              <select className="input" style={{ width: 180 }} aria-label="Filter by entity" value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="">All entities</option>
                {entities.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            }
            columns={[
              { key: 'when', header: 'When', sort: (e) => e.createdAt, render: (e) => new Date(e.createdAt).toLocaleString() },
              { key: 'who', header: 'Who', sort: (e) => e.actorEmail ?? '', render: (e) => e.actorEmail ?? <span className="muted">System or deleted</span> },
              { key: 'action', header: 'Action', sort: (e) => e.action, render: (e) => <code>{e.action}</code> },
              { key: 'entity', header: 'Entity', sort: (e) => e.entity, render: (e) => <span className="muted small">{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ''}</span> },
            ]}
          />
          <div className="row end">
            <Button tone="secondary" small disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Newer
            </Button>
            <Button tone="secondary" small disabled={audit.data.length < PAGE} onClick={() => setOffset(offset + PAGE)}>
              Older
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
