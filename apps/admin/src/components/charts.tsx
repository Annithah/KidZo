import { Link } from 'react-router';
import { Icon, type IconName } from './Icon';

/** KPI card with icon, value, optional trend and sparkline. */
export function KpiCard({ label, value, icon, world, trend, spark }: { label: string; value: string | number; icon: IconName; world: string; trend?: number | null; spark?: number[] }) {
  const dir = trend == null ? null : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className="kpi-icon" style={{ background: `var(--${world}-50)`, color: `var(--${world}-800)` }}>
          <Icon name={icon} size={20} accent={`var(--${world}-300)`} />
        </span>
        <span className="kpi-label">{label}</span>
        {dir ? (
          <span className={`trend ${dir}`} title="Today compared with yesterday">
            <Icon name={dir === 'up' ? 'trendUp' : dir === 'down' ? 'trendDown' : 'trendFlat'} size={12} />
            {dir === 'flat' ? 'Same' : `${trend! > 0 ? '+' : ''}${trend}`}
            <span className="sr-only"> compared with yesterday</span>
          </span>
        ) : null}
      </div>
      <div className="kpi-value">{value}</div>
      {spark && spark.length > 1 ? <Sparkline values={spark} color={`var(--${world}-500)`} label={`${label}, last ${spark.length} days`} /> : null}
    </div>
  );
}

export function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const W = 200;
  const H = 36;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - (v / max) * (H - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none" style={{ height: 36 }}>
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Grouped bar chart (up to 3 series) with gridlines and a data table for screen readers. */
export function BarChart({ labels, series, height = 220, title }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number; title: string }) {
  const W = 640;
  const pad = { l: 32, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = Math.ceil(max / 4) * 4 || 4;
  const innerW = W - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const group = innerW / Math.max(1, labels.length);
  const bar = Math.min(18, (group * 0.7) / series.length);
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => {
          const y = pad.t + innerH - innerH * g;
          return (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray={g === 0 ? undefined : '3 5'} />
              <text x={pad.l - 6} y={y + 4} textAnchor="end">
                {Math.round(nice * g)}
              </text>
            </g>
          );
        })}
        {labels.map((label, i) => {
          const x0 = pad.l + i * group + (group - bar * series.length) / 2;
          return (
            <g key={label}>
              {series.map((s, j) => {
                const v = s.values[i] ?? 0;
                const h = (v / nice) * innerH;
                return <rect key={s.name} x={x0 + j * bar} y={pad.t + innerH - h} width={bar - 3} height={Math.max(h, v ? 2 : 0)} rx={4} fill={s.color}><title>{`${s.name}: ${v}`}</title></rect>;
              })}
              <text x={pad.l + i * group + group / 2} y={height - 8} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Day</th>
            {series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l}>
              <td>{l}</td>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Ranked list with proportional bars. */
export function RankList({ items, unit = 'plays' }: { items: { id: string; title: string; value: number; to?: string; suffix?: string }[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rank">
      {items.map((item) => (
        <div key={item.id} className="rank-item">
          {item.to ? <Link to={item.to}>{item.title}</Link> : <span style={{ fontWeight: 700 }}>{item.title}</span>}
          <span className="muted small">
            {item.value} {item.suffix ?? unit}
          </span>
          <div className="rank-bar" aria-hidden>
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
