import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { SKILL_LABELS } from '@kidzo/shared';
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
            <Stat label="Completion rate" value={`${stats.data.completionRatePercent}%`} />
            <Stat label="Average play" value={durationLabel(stats.data.averagePlaySeconds)} />
            <Stat label="Average completed adventure" value={durationLabel(stats.data.averageCompletionSeconds)} />
          </div>
          <div className="grid two">
            <RankedContent title="Most played this week" items={stats.data.topContent} empty="No plays yet this week." />
            <RankedContent title="Most played games" items={stats.data.topGames} empty="No games played this week." />
            <div className="card stack">
              <h2>Popular learning categories</h2>
              {stats.data.topSkills.length === 0 ? (
                <Empty>No category activity yet this week.</Empty>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Plays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.topSkills.map(({ skill, plays }) => (
                      <tr key={skill}>
                        <td>{SKILL_LABELS[skill]}</td>
                        <td>{plays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card stack">
              <h2>Content to review</h2>
              <p className="muted small">Lowest completion rate, for content with at least 3 plays this week.</p>
              {stats.data.lowEngagementContent.length === 0 ? (
                <Empty>No content has enough plays to flag yet.</Empty>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Plays</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.data.lowEngagementContent.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/content/${item.id}`}>{item.title}</Link>
                        </td>
                        <td>{item.plays}</td>
                        <td>{item.completionRatePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="card stack">
            <h2>Weekly activity</h2>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Day (UTC)</th>
                    <th>New families</th>
                    <th>New children</th>
                    <th>Plays</th>
                    <th>Completions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.dailyActivity.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.newFamilies}</td>
                      <td>{day.newChildren}</td>
                      <td>{day.plays}</td>
                      <td>{day.completions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function RankedContent({ title, items, empty }: { title: string; items: { id: string; title: string; plays: number }[]; empty: string }) {
  return (
    <div className="card stack">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Plays</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link to={`/content/${item.id}`}>{item.title}</Link>
                </td>
                <td>{item.plays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${remainder}s` : remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}
