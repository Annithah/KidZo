import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import type { StoryChoiceInsights } from '@kidzo/shared';
import { api } from '../api';
import { Empty, ErrorBox, Loading } from './ui';

const RANGES = [7, 30, 90] as const;

/** Horizontal share bar with the count and percent beside it. */
function Share({ label, count, percent }: { label: string; count: number; percent: number }) {
  return (
    <div className="share">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <span style={{ flex: 1 }}>{label}</span>
        <span className="muted small">
          {count} ({percent}%)
        </span>
      </div>
      <div className="share-track" aria-hidden>
        <div className="share-fill" style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
    </div>
  );
}

function StoryCard({ story }: { story: StoryChoiceInsights['stories'][number] }) {
  return (
    <article className="card stack tight" aria-labelledby={`story-${story.id}`}>
      <div className="card-head">
        <h3 id={`story-${story.id}`}>
          <Link to={`/content/${story.id}`}>{story.title}</Link>
        </h3>
        <span className="muted small">{story.paths} finished plays</span>
      </div>
      <div className="grid two">
        <section className="stack tight" aria-label={`Endings of ${story.title}`}>
          <h4>Endings reached</h4>
          {story.endings.map((e) => (
            <Share key={e.nodeId} label={e.text} count={e.count} percent={e.percent} />
          ))}
        </section>
        <section className="stack tight" aria-label={`Choices in ${story.title}`}>
          <h4>Choices picked</h4>
          {story.choices.length === 0 ? <p className="muted small">This story has no choice scenes.</p> : null}
          {story.choices.map((c) => (
            <div key={c.nodeId} className="stack tight">
              <p className="small" style={{ margin: 0, fontWeight: 700 }}>
                {c.text} <span className="muted">({c.reached} times)</span>
              </p>
              {c.picks.map((p) => (
                <Share key={p.choiceId} label={p.label} count={p.count} percent={p.percent} />
              ))}
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}

/** Popular story choices and endings, aggregated across all families. No child is identified. */
export function StoryChoices() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const query = useQuery({ queryKey: ['story-choices', days], queryFn: () => api.storyChoices(days) });
  return (
    <section className="stack tight" aria-labelledby="choices">
      <div className="row">
        <h2 id="choices" style={{ flex: 1 }}>
          Story choices and endings
        </h2>
        <div className="row" role="group" aria-label="Date range">
          {RANGES.map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">From finished adventures by signed-in families. Counts are totals only; no child is identified.</p>
      {query.isLoading ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorBox error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.stories.length === 0 ? (
        <Empty title="No finished adventures yet" art="category.magical-adventures">
          Choices and endings appear here once children finish branching adventures.
        </Empty>
      ) : (
        query.data.stories.map((story) => <StoryCard key={story.id} story={story} />)
      )}
    </section>
  );
}
