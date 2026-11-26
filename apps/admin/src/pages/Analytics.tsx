import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { SKILL_LABELS } from '@kidzo/shared';
import { SKILL_CATEGORY, CATEGORIES } from '@kidzo/ui-tokens';
import { api } from '../api';
import { Art } from '../components/Art';
import { BarChart, KpiCard, RankList } from '../components/charts';
import { DataTable } from '../components/DataTable';
import { StoryChoices } from '../components/StoryChoices';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { dayLabel, durationLabel } from './Dashboard';

const categoryArt = (skill: string) => CATEGORIES.find((c) => c.key === SKILL_CATEGORY[skill])?.art ?? 'object.sparkles';

export function AnalyticsPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  return (
    <>
      <PageHeader kicker="Insights" title="Analytics" description="Privacy-conscious, aggregate engagement for the last 7 days. Guest plays are included as anonymous daily totals." />
      {stats.isLoading ? (
        <Loading />
      ) : stats.error || !stats.data ? (
        <ErrorBox error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="stack">
          <div className="grid kpis">
            <KpiCard label="Completion rate" value={`${stats.data.completionRatePercent}%`} icon="trophy" world="star" />
            <KpiCard label="Average play" value={durationLabel(stats.data.averagePlaySeconds)} icon="timer" world="tangerine" />
            <KpiCard label="Average completed adventure" value={durationLabel(stats.data.averageCompletionSeconds)} icon="adventure" world="grape" />
            <KpiCard label="Waiting for review" value={stats.data.content.review} icon="eye" world="sky" />
          </div>

          <section className="card" aria-labelledby="growth">
            <div className="card-head">
              <h2 id="growth">Family growth</h2>
            </div>
            <BarChart
              title="New families and new child profiles per day"
              labels={stats.data.dailyActivity.map((d) => dayLabel(d.date))}
              series={[
                { name: 'New families', color: 'var(--sky-500)', values: stats.data.dailyActivity.map((d) => d.newFamilies) },
                { name: 'New children', color: 'var(--grape-400)', values: stats.data.dailyActivity.map((d) => d.newChildren) },
              ]}
            />
          </section>

          <div className="grid two">
            <section className="card" aria-labelledby="top-games">
              <div className="card-head">
                <h2 id="top-games">Most played games</h2>
              </div>
              {stats.data.topGames.length === 0 ? (
                <Empty title="No games played this week" art="category.brain-games" />
              ) : (
                <RankList items={stats.data.topGames.map((g) => ({ id: g.id, title: g.title, value: g.plays, to: `/content/${g.id}` }))} />
              )}
            </section>
            <section className="card" aria-labelledby="top-skills">
              <div className="card-head">
                <h2 id="top-skills">Popular learning categories</h2>
              </div>
              {stats.data.topSkills.length === 0 ? (
                <Empty title="No category activity yet" art="category.learning" />
              ) : (
                <div className="rank">
                  {stats.data.topSkills.map(({ skill, plays }) => (
                    <div key={skill} className="row" style={{ flexWrap: 'nowrap' }}>
                      <Art art={categoryArt(skill)} size={36} />
                      <strong style={{ flex: 1 }}>{SKILL_LABELS[skill]}</strong>
                      <span className="muted small">{plays} plays</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="stack tight" aria-labelledby="review">
            <h2 id="review">Content to review</h2>
            <p className="muted small">Lowest completion rate, for content with at least 3 plays this week.</p>
            <DataTable
              caption="Content with the lowest completion rate"
              rows={stats.data.lowEngagementContent}
              rowKey={(r) => r.id}
              initialSort={{ key: 'rate', dir: 'asc' }}
              empty={{ title: 'Nothing to flag yet', body: 'Content needs at least 3 plays this week to be reviewed.' }}
              columns={[
                { key: 'title', header: 'Title', sort: (r) => r.title, render: (r) => <Link to={`/content/${r.id}`} style={{ fontWeight: 700 }}>{r.title}</Link> },
                { key: 'plays', header: 'Plays', numeric: true, sort: (r) => r.plays, render: (r) => r.plays },
                { key: 'rate', header: 'Completed', numeric: true, sort: (r) => r.completionRatePercent, render: (r) => `${r.completionRatePercent}%` },
              ]}
            />
          </section>

          <StoryChoices />

          <section className="stack tight" aria-labelledby="daily">
            <h2 id="daily">Daily totals (UTC)</h2>
            <DataTable
              caption="Daily totals"
              rows={stats.data.dailyActivity}
              rowKey={(r) => r.date}
              initialSort={{ key: 'date', dir: 'desc' }}
              columns={[
                { key: 'date', header: 'Day', sort: (r) => r.date, render: (r) => r.date },
                { key: 'fam', header: 'New families', numeric: true, sort: (r) => r.newFamilies, render: (r) => r.newFamilies },
                { key: 'kids', header: 'New children', numeric: true, sort: (r) => r.newChildren, render: (r) => r.newChildren },
                { key: 'plays', header: 'Plays', numeric: true, sort: (r) => r.plays, render: (r) => r.plays },
                { key: 'done', header: 'Completions', numeric: true, sort: (r) => r.completions, render: (r) => r.completions },
              ]}
            />
          </section>
        </div>
      )}
    </>
  );
}
