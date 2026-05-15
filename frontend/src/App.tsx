import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import CookieBanner from './components/CookieBanner';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import Settings from './pages/Settings';
import CheckIn from './pages/CheckIn';
import Login from './pages/Login';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import TermsOfService from './pages/TermsOfService';

// Minimal footer shown on all public pages (login, legal)
function PublicFooter() {
  const { pathname } = useLocation();
  const legalRoutes = ['/login', '/privacy', '/cookies', '/terms'];
  if (!legalRoutes.some(r => pathname.startsWith(r))) return null;
  return (
    <footer style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid #1e293b' }}>
      <a href="/privacy" style={{ color: '#94a3b8', marginRight: '1rem' }}>Política de Privacidad</a>
      <a href="/cookies" style={{ color: '#94a3b8', marginRight: '1rem' }}>Política de Cookies</a>
      <a href="/terms" style={{ color: '#94a3b8' }}>Términos de Servicio</a>
    </footer>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PublicFooter />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="events/create" element={<CreateEvent />} />
            <Route path="check-in" element={<CheckIn />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <CookieBanner />
    </AuthProvider>
  );
}

export default App;
