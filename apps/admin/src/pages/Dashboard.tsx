import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { Empty, ErrorBox, Loading } from '../components/ui';

export function DashboardPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <p className="kicker" style={{ margin: 0 }}>
            Overview
          </p>
          <h1>Dashboard</h1>
        </div>
        <Link to="/content/new" className="btn">
          + New content
        </Link>
      </div>
      {stats.isLoading ? (
        <Loading />
      ) : stats.error || !stats.data ? (
        <ErrorBox error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="stack">
          <div className="grid stats">
            <Stat label="Parent accounts" value={stats.data.parents} />
            <Stat label="Child profiles" value={stats.data.children} />
            <Stat label="Published" value={stats.data.content.published} />
            <Stat label="Drafts" value={stats.data.content.draft} />
            <Stat label="Plays (7 days)" value={stats.data.sessionsLast7Days} />
            <Stat label="Completions (7 days)" value={stats.data.completionsLast7Days} />
          </div>
          <div className="card stack">
            <h2>Most played this week</h2>
            {stats.data.topContent.length === 0 ? (
              <Empty>No plays yet this week.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Plays</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.topContent.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/content/${c.id}`}>{c.title}</Link>
                      </td>
                      <td>{c.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
