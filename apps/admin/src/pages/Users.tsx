import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { Empty, ErrorBox, Loading } from '../components/ui';

const PAGE = 25;

export function UsersPage() {
  const [offset, setOffset] = useState(0);
  const users = useQuery({ queryKey: ['users', offset], queryFn: () => api.users(offset, PAGE) });

  return (
    <>
      <div className="page-head">
        <h1>Families</h1>
      </div>
      <p className="muted">Account emails and child counts only. Child names and play history stay private to each family.</p>
      {users.isLoading ? (
        <Loading />
      ) : users.error || !users.data ? (
        <ErrorBox error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <Empty>No accounts yet.</Empty>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Children</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.childCount}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn small secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Previous
            </button>
            <span className="muted small">
              {offset + 1}-{Math.min(offset + PAGE, users.data.total)} of {users.data.total}
            </span>
            <button type="button" className="btn small secondary" disabled={offset + PAGE >= users.data.total} onClick={() => setOffset(offset + PAGE)}>
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
