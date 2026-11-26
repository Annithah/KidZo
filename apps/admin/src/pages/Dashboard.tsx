import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { AdminStats, AuditEntry } from '@kidzo/shared';
import { api } from '../api';
import { BarChart, KpiCard, RankList } from '../components/charts';
import { Icon, type IconName } from '../components/Icon';
import { ButtonLink, Empty, ErrorBox, PageHeader, Skeleton } from '../components/ui';

export const durationLabel = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes === 0 ? `${remainder}s` : remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
};

/** Today minus yesterday from the 7 day series, or null with less than 2 days. */
const dayTrend = (values: number[]) => (values.length >= 2 ? (values[values.length - 1] ?? 0) - (values[values.length - 2] ?? 0) : null);
export const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString([], { weekday: 'short' });

const ACTION_ICON: Record<string, IconName> = { publish: 'publish', unpublish: 'unpublish', archive: 'archive', delete: 'delete', create: 'plus', update: 'edit', login: 'user' };
const actionIcon = (action: string): IconName => ACTION_ICON[action.split('.').pop() ?? ''] ?? 'activity';
const describe = (e: AuditEntry) => `${e.action.replace(/[._]/g, ' ')} on ${e.entity}`;

export function DashboardPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const audit = useQuery({ queryKey: ['audit', 0], queryFn: () => api.audit(0, 8) });

  return (
    <>
      <PageHeader kicker="Overview" title="Dashboard" description="How families are playing this week." actions={<ButtonLink to="/content/new" icon="plus">New content</ButtonLink>} />
      {stats.isLoading ? (
        <div className="grid kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card">
              <Skeleton rows={3} />
            </div>
          ))}
        </div>
      ) : stats.error || !stats.data ? (
        <ErrorBox error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <Overview stats={stats.data} audit={audit.data ?? []} auditLoading={audit.isLoading} />
      )}
    </>
  );
}

function Overview({ stats, audit, auditLoading }: { stats: AdminStats; audit: AuditEntry[]; auditLoading: boolean }) {
  const plays = stats.dailyActivity.map((d) => d.plays);
  const completions = stats.dailyActivity.map((d) => d.completions);
  const families = stats.dailyActivity.map((d) => d.newFamilies);
  const children = stats.dailyActivity.map((d) => d.newChildren);
  return (
    <div className="stack">
      <div className="grid kpis">
        <KpiCard label="Plays, last 7 days" value={stats.sessionsLast7Days} icon="play" world="coral" trend={dayTrend(plays)} spark={plays} />
        <KpiCard label="Completions" value={stats.completionsLast7Days} icon="checkCircle" world="mint" trend={dayTrend(completions)} spark={completions} />
        <KpiCard label="Parent accounts" value={stats.parents} icon="families" world="sky" trend={dayTrend(families)} spark={families} />
        <KpiCard label="Child profiles" value={stats.children} icon="child" world="grape" trend={dayTrend(children)} spark={children} />
      </div>
      <div className="grid kpis">
        <KpiCard label="Completion rate" value={`${stats.completionRatePercent}%`} icon="trophy" world="star" />
        <KpiCard label="Average play" value={durationLabel(stats.averagePlaySeconds)} icon="timer" world="tangerine" />
        <KpiCard label="Published" value={stats.content.published} icon="publish" world="leaf" />
        <KpiCard label="Drafts and in review" value={`${stats.content.draft} / ${stats.content.review}`} icon="edit" world="bubblegum" />
      </div>

      <div className="grid two">
        <section className="card" aria-labelledby="activity-title">
          <div className="card-head">
            <h2 id="activity-title">Daily activity</h2>
            <Link to="/analytics" className="small muted">
              Full analytics
            </Link>
          </div>
          <BarChart
            title="Plays and completions per day, last 7 days"
            labels={stats.dailyActivity.map((d) => dayLabel(d.date))}
            series={[
              { name: 'Plays', color: 'var(--coral-400)', values: plays },
              { name: 'Completions', color: 'var(--mint-500)', values: completions },
            ]}
          />
        </section>
        <section className="card" aria-labelledby="recent-title">
          <div className="card-head">
            <h2 id="recent-title">Recent activity</h2>
            <Link to="/audit" className="small muted">
              Audit log
            </Link>
          </div>
          {auditLoading ? (
            <Skeleton rows={5} />
          ) : audit.length === 0 ? (
            <Empty title="No activity yet" />
          ) : (
            <ul className="activity">
              {audit.map((e) => (
                <li key={e.id}>
                  <span className="dot">
                    <Icon name={actionIcon(e.action)} size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{describe(e)}</div>
                    <div className="muted small">
                      {e.actorEmail ?? 'System'} · {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="top-title">
        <div className="card-head">
          <h2 id="top-title">Most played this week</h2>
        </div>
        {stats.topContent.length === 0 ? (
          <Empty title="No plays yet this week" art="zo.waving">
            Plays show up here as soon as families start an adventure.
          </Empty>
        ) : (
          <RankList items={stats.topContent.map((c) => ({ id: c.id, title: c.title, value: c.plays, to: `/content/${c.id}` }))} />
        )}
      </section>
    </div>
  );
}
