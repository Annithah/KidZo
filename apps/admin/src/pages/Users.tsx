import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { DataTable } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { Button, ErrorBox, Loading, PageHeader } from '../components/ui';

const PAGE = 100;

export function UsersPage() {
  const [offset, setOffset] = useState(0);
  const users = useQuery({ queryKey: ['users', offset], queryFn: () => api.users(offset, PAGE) });
  const total = users.data?.total ?? 0;

  return (
    <>
      <PageHeader kicker="People" title="Families" description="Account emails and child counts only. Child names and play history stay private to each family." />
      {users.isLoading ? (
        <Loading />
      ) : users.error || !users.data ? (
        <ErrorBox error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <div className="stack">
          <DataTable
            caption="Family accounts"
            rows={users.data.items}
            rowKey={(u) => u.id}
            searchText={(u) => `${u.displayName} ${u.email}`}
            searchLabel="Search names and emails"
            initialSort={{ key: 'joined', dir: 'desc' }}
            empty={{ title: 'No accounts yet' }}
            columns={[
              {
                key: 'name',
                header: 'Name',
                sort: (u) => u.displayName,
                render: (u) => (
                  <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <Icon name="user" size={18} />
                    <strong>{u.displayName}</strong>
                  </span>
                ),
              },
              { key: 'email', header: 'Email', sort: (u) => u.email, render: (u) => u.email },
              { key: 'role', header: 'Role', sort: (u) => u.role, render: (u) => <span className="badge neutral">{u.role}</span> },
              { key: 'kids', header: 'Children', numeric: true, sort: (u) => u.childCount, render: (u) => u.childCount },
              { key: 'joined', header: 'Joined', sort: (u) => u.createdAt, render: (u) => new Date(u.createdAt).toLocaleDateString() },
            ]}
          />
          {total > PAGE ? (
            <div className="row end">
              <span className="muted small">
                Loaded {offset + 1} to {Math.min(offset + PAGE, total)} of {total}
              </span>
              <Button tone="secondary" small disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                Previous batch
              </Button>
              <Button tone="secondary" small disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                Next batch
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
