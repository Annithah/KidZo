import { useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from './auth';
import { Icon, type IconName } from './components/Icon';
import { OverflowMenu } from './components/feedback';
import { Loading } from './components/ui';
import { AnalyticsPage } from './pages/Analytics';
import { AuditPage } from './pages/Audit';
import { ContentEditorPage } from './pages/ContentEditor';
import { ContentListPage } from './pages/ContentList';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { StickersPage } from './pages/Stickers';
import { UsersPage } from './pages/Users';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Query string that must match for the item to be active (content filters). */
  view?: string;
}

const NAV: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }, { to: '/analytics', label: 'Analytics', icon: 'analytics' }] },
  {
    label: 'Library',
    items: [
      { to: '/content', label: 'Content', icon: 'content' },
      { to: '/content?view=stories', label: 'Stories', icon: 'story', view: 'stories' },
      { to: '/content?view=games', label: 'Games', icon: 'game', view: 'games' },
      { to: '/stickers', label: 'Stickers', icon: 'sticker' },
    ],
  },
  { label: 'People', items: [{ to: '/users', label: 'Families', icon: 'families' }, { to: '/audit', label: 'Audit log', icon: 'audit' }] },
];

function SideNav() {
  const location = useLocation();
  const [params] = useSearchParams();
  const view = params.get('view');
  const isActive = (item: NavItem) => {
    if (item.to === '/') return location.pathname === '/';
    const path = item.to.split('?')[0] ?? item.to;
    if (path === '/content') {
      if (!location.pathname.startsWith('/content')) return false;
      return item.view ? view === item.view : !view;
    }
    return location.pathname.startsWith(path);
  };
  return (
    <nav className="sidebar" aria-label="Main">
      <Link to="/" className="brand" aria-label="KIDZO dashboard home">
        <img src="/logo.png" alt="KIDZO" />
      </Link>
      {NAV.map((group) => (
        <div key={group.label} style={{ display: 'contents' }}>
          <div className="nav-label">{group.label}</div>
          {group.items.map((item) => {
            const active = isActive(item);
            return (
              <NavLink key={item.to} to={item.to} className={() => `nav-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon name={item.icon} size={20} accent={active ? 'var(--coral-400)' : 'var(--navy-300)'} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
      <div className="spacer" />
      <div className="sidebar-foot">Content dashboard</div>
    </nav>
  );
}

const CRUMBS: Record<string, string> = { '': 'Dashboard', analytics: 'Analytics', content: 'Content', stickers: 'Stickers', users: 'Families', audit: 'Audit log', new: 'New content' };

function TopBar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const parts = location.pathname.split('/').filter(Boolean);
  const view = params.get('view');
  const crumbs = [{ to: '/', label: 'KIDZO' }, ...parts.map((p, i) => ({ to: `/${parts.slice(0, i + 1).join('/')}`, label: CRUMBS[p] ?? 'Edit content' }))];
  if (parts[0] === 'content' && view) crumbs.push({ to: location.pathname + location.search, label: view === 'games' ? 'Games' : 'Stories' });

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/content?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.to + i} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            {i > 0 ? <Icon name="forward" size={12} /> : null}
            {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
          </span>
        ))}
      </nav>
      <form className="search" role="search" onSubmit={search}>
        <Icon name="search" size={16} />
        <input aria-label="Search content" placeholder="Search content" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
          {user?.email}
        </span>
        <OverflowMenu label="Account menu" items={[{ label: 'Sign out', icon: 'signOut', onSelect: () => void signOut() }]} />
      </div>
    </header>
  );
}

export function App() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') return <LoginPage />;

  return (
    <div className="layout">
      <SideNav />
      <div className="main">
        <TopBar />
        <main className="content" id="main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/content" element={<ContentListPage />} />
            <Route path="/content/new" element={<ContentEditorPage />} />
            <Route path="/content/:id" element={<ContentEditorPage />} />
            <Route path="/stickers" element={<StickersPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
