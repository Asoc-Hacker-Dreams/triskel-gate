import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Settings, LogOut, Ticket, ScanLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.email
    ? user.email.substring(0, 1).toUpperCase()
    : 'U';

  const displayName = (user as any)?.user_metadata?.full_name
    || (user as any)?.name
    || user?.email
    || 'User';

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Ticket size={28} />
          <span>Triskell Gate</span>
        </div>

        <nav className="nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/check-in"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <ScanLine size={20} />
            <span>Check-in</span>
          </NavLink>

          <NavLink
            to="/events"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <CalendarDays size={20} />
            <span>Events</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <a href="/privacy" style={{ display: 'block', color: '#6b7280', fontSize: '0.72rem', textDecoration: 'none', marginBottom: '0.2rem' }}>Política de Privacidad</a>
            <a href="/cookies" style={{ display: 'block', color: '#6b7280', fontSize: '0.72rem', textDecoration: 'none', marginBottom: '0.2rem' }}>Política de Cookies</a>
            <a href="/terms" style={{ display: 'block', color: '#6b7280', fontSize: '0.72rem', textDecoration: 'none' }}>Términos de Servicio</a>
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="user-profile">
            <div className="avatar">{initials}</div>
            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{displayName}</span>
          </div>
        </header>

        <div className="page-container animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
