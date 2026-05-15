import React, { useState } from 'react';
import { Ticket, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  const handleOAuthLogin = async (provider: 'google' | 'apple' | 'azure') => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-branding">
        <div className="login-branding-content">
          <Ticket size={48} />
          <h1>Triskell Gate</h1>
          <p>The modern event platform for organizers who demand more.</p>
        </div>
        <div className="login-branding-decoration" />
      </div>

      <div className="login-form-side">
        <div className="login-card animate-fade-in">
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in to your organizer account</p>

          {error && <div className="login-error">{error}</div>}

          {magicSent ? (
            <div className="login-magic-sent">
              <Mail size={32} />
              <p>Check your inbox — we sent a magic link to <strong>{magicEmail}</strong>.</p>
              <button className="btn-link" onClick={() => setMagicSent(false)}>Use a different email</button>
            </div>
          ) : (
            <>
              <form className="login-magic-form" onSubmit={handleMagicLink}>
                <label htmlFor="magic-email">Email</label>
                <div className="login-magic-row">
                  <input
                    id="magic-email"
                    type="email"
                    value={magicEmail}
                    onChange={e => setMagicEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                  />
                  <button type="submit" className="login-provider-btn" disabled={loading || !magicEmail}>
                    <Mail size={18} />
                    <span>Magic Link</span>
                  </button>
                </div>
              </form>

              <div className="login-divider"><span>or continue with</span></div>

              <div className="login-social-row">
                <button className="login-social-btn" onClick={() => handleOAuthLogin('google')} disabled={loading}>
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button className="login-social-btn" onClick={() => handleOAuthLogin('apple')} disabled={loading}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.9 8.75c1.26.06 2.14.72 2.88.76.83-.17 2.54-1.03 4.07-.88 1.68.17 2.95.89 3.78 2.2-3.42 2.08-2.62 6.26.42 7.47-.5 1.32-1.15 2.63-3 3.98zM12.03 8.67c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Apple
                </button>
                <button className="login-social-btn" onClick={() => handleOAuthLogin('azure')} disabled={loading}>
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#f25022" d="M1 1h10v10H1z"/>
                    <path fill="#00a4ef" d="M1 13h10v10H1z"/>
                    <path fill="#7fba00" d="M13 1h10v10H13z"/>
                    <path fill="#ffb900" d="M13 13h10v10H13z"/>
                  </svg>
                  Microsoft
                </button>
              </div>
            </>
          )}

          <p className="login-footer-note">
            By signing in, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
            <br />No passwords are stored — ever.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
