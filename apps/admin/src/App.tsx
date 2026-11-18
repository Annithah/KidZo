import { NavLink, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth';
import { Loading } from './components/ui';
import { AuditPage } from './pages/Audit';
import { ContentEditorPage } from './pages/ContentEditor';
import { ContentListPage } from './pages/ContentList';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { StickersPage } from './pages/Stickers';
import { UsersPage } from './pages/Users';

export function App() {
  const { status, user, signOut } = useAuth();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') return <LoginPage />;

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Main">
        <img src="/logo.png" alt="KIDZO" />
        <NavLink to="/" end>
          📊 Dashboard
        </NavLink>
        <NavLink to="/content">📚 Content</NavLink>
        <NavLink to="/stickers">🏅 Stickers</NavLink>
        <NavLink to="/users">👨‍👩‍👧 Families</NavLink>
        <NavLink to="/audit">📝 Audit log</NavLink>
        <div className="spacer" />
        <span className="small" style={{ opacity: 0.8 }}>
          {user?.email}
        </span>
        <button type="button" className="btn secondary small" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
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
  );
}
