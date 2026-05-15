import React, { useState, useEffect } from 'react';
import { CreditCard, Shield, Zap, Crown, CheckCircle, Lock } from 'lucide-react';
import './Settings.css';

interface PlanInfo {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  accent: string;
  icon: React.ReactNode;
  current?: boolean;
}

const plans: PlanInfo[] = [
  {
    id: 'free',
    name: 'Starter',
    price: '€0',
    period: 'forever',
    features: [
      '1 active event',
      'Up to 50 tickets',
      'Basic analytics',
      'Email support',
    ],
    accent: '#6b7280',
    icon: <Zap size={22} />,
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€49',
    period: '/month',
    features: [
      'Unlimited events',
      'Up to 5,000 tickets/event',
      'Advanced analytics',
      'AgoraPass integration',
      'Priority support',
      'Custom branding',
    ],
    accent: '#6366f1',
    icon: <Shield size={22} />,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '€199',
    period: '/month',
    features: [
      'Everything in Pro',
      'Unlimited tickets',
      'Multi-organizer support',
      'White-label solution',
      'Dedicated account manager',
      'SLA guarantee',
      'API access',
    ],
    accent: '#f59e0b',
    icon: <Crown size={22} />,
  },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'billing' | 'account' | 'privacy'>('billing');

  // GDPR state
  interface ConsentRecord {
    consent_type: string;
    granted: boolean;
    granted_at: string | null;
    method: string;
    updated_at: string;
  }
  const CONSENT_LABELS: Record<string, string> = {
    essential: 'Essential (required)',
    analytics: 'Analytics',
    marketing: 'Marketing',
    newsletters: 'Newsletters',
    product_updates: 'Product Updates',
    partner_promos: 'Partner Promotions',
  };

  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentsLoading, setConsentsLoading] = useState(false);
  const [gdprMsg, setGdprMsg] = useState('');
  const [gdprErr, setGdprErr] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
  });

  const fetchConsents = async () => {
    setConsentsLoading(true);
    try {
      const res = await fetch('/api/consents', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConsents(data.data ?? []);
      }
    } catch { /* non-blocking */ } finally {
      setConsentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'privacy') fetchConsents();
  }, [activeTab]);

  const updateConsent = async (consentType: string, granted: boolean) => {
    setGdprMsg(''); setGdprErr('');
    try {
      const res = await fetch('/api/consents', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ consent_type: consentType, granted }),
      });
      if (res.ok) {
        setConsents(prev => prev.map(c => c.consent_type === consentType ? { ...c, granted } : c));
        setGdprMsg('Preference saved.');
      } else {
        setGdprErr('Failed to save preference.');
      }
    } catch { setGdprErr('Connection error.'); }
    setTimeout(() => { setGdprMsg(''); setGdprErr(''); }, 3000);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data-export', { headers: getAuthHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'data-export.json'; a.click();
        URL.revokeObjectURL(url);
      } else {
        setGdprErr('Export failed.'); setTimeout(() => setGdprErr(''), 3000);
      }
    } catch { setGdprErr('Connection error.'); setTimeout(() => setGdprErr(''), 3000); }
    finally { setExporting(false); }
  };

  const doDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE', headers: getAuthHeaders() });
      if (res.status === 204) { localStorage.clear(); window.location.href = '/login'; }
      else { setGdprErr('Error deleting account.'); setTimeout(() => setGdprErr(''), 4000); }
    } catch { setGdprErr('Connection error.'); setTimeout(() => setGdprErr(''), 4000); }
    finally { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });
      
      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout session', err);
    }
  };

  return (
    <div className="settings animate-fade-in">
      <h1>Settings</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
        Manage your subscription, billing, and account preferences.
      </p>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <CreditCard size={16} /> Billing & Plans
        </button>
        <button
          className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <Shield size={16} /> Account
        </button>
        <button
          className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          <Lock size={16} /> Privacy & Datos
        </button>
      </div>

      {activeTab === 'billing' && (
        <div className="billing-content">
          {/* Current Plan Notice */}
          <div className="current-plan-banner">
            <div>
              <strong>Current Plan:</strong> Starter (Free)
            </div>
            <span className="plan-badge">Active</span>
          </div>

          {/* Pricing Cards */}
          <div className="pricing-grid">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`pricing-card ${plan.current ? 'current' : ''}`}
                style={{ '--plan-accent': plan.accent } as React.CSSProperties}
              >
                <div className="pricing-icon" style={{ backgroundColor: plan.accent + '18', color: plan.accent }}>
                  {plan.icon}
                </div>
                <h3 className="pricing-name">{plan.name}</h3>
                <div className="pricing-price">
                  <span className="price-amount">{plan.price}</span>
                  <span className="price-period">{plan.period}</span>
                </div>
                <ul className="pricing-features">
                  {plan.features.map((f, i) => (
                    <li key={i}>
                      <CheckCircle size={14} style={{ color: plan.accent, flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`btn ${plan.current ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%', marginTop: 'auto' }}
                  disabled={plan.current}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {plan.current ? 'Current Plan' : `Upgrade to ${plan.name}`}
                </button>
                <p className="pricing-note">
                  {plan.id === 'free' ? 'No credit card required' : 'Powered by Stripe • Cancel anytime'}
                </p>
              </div>
            ))}
          </div>

          <div className="billing-info-box">
            <Shield size={18} />
            <div>
              <strong>Secure Payments</strong>
              <p>
                All transactions are processed through Stripe. We never store credit card
                information on our servers.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="account-content">
          <div className="card">
            <h3>Authentication</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Your account uses federated authentication via Supabase. You sign in
              using Passkeys, Google, Apple, or Microsoft — no passwords stored.
            </p>
            <div className="auth-providers">
              <div className="auth-provider-badge">
                <img src="https://www.google.com/favicon.ico" alt="Google" width={16} height={16} />
                Google
              </div>
              <div className="auth-provider-badge">
                <span>🍎</span> Apple
              </div>
              <div className="auth-provider-badge">
                <span>🔑</span> Passkey
              </div>
              <div className="auth-provider-badge">
                <img src="https://www.microsoft.com/favicon.ico" alt="Microsoft" width={16} height={16} />
                Microsoft
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="account-content">
          {/* Consent Management */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>Communication Preferences</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Manage how we use your data. Essential cookies cannot be disabled.
            </p>
            {consentsLoading ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading preferences…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {consents.map(c => (
                  <label key={c.consent_type} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: c.consent_type === 'essential' ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={c.granted}
                      disabled={c.consent_type === 'essential'}
                      onChange={() => updateConsent(c.consent_type, !c.granted)}
                    />
                    <span>{CONSENT_LABELS[c.consent_type] ?? c.consent_type}</span>
                  </label>
                ))}
                {consents.length === 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>No consent records found.</p>
                )}
              </div>
            )}
            {gdprMsg && <p style={{ color: '#22c55e', marginTop: '0.5rem', fontSize: '0.875rem' }}>{gdprMsg}</p>}
            {gdprErr && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.875rem' }}>{gdprErr}</p>}
          </div>

          {/* Data Export */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3>Export Your Data</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Download a copy of all your personal data (GDPR Art. 15 – Right of Access).
            </p>
            <button
              className="btn btn-secondary"
              onClick={exportData}
              disabled={exporting}
              style={{ opacity: exporting ? 0.7 : 1 }}
            >
              {exporting ? 'Exporting…' : 'Download my data (JSON)'}
            </button>
          </div>

          {/* Delete Account */}
          <div className="card">
            <h3 style={{ color: '#ef4444' }}>Delete Account</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
              Request erasure of your personal data (GDPR Art. 17). Financial records (orders/tickets) are retained
              as required by law for 7 years.
            </p>
            {!showDeleteConfirm ? (
              <button
                className="btn btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Request account deletion
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ color: '#ef4444', fontWeight: 600 }}>
                  Are you sure? This action is irreversible. Your account will be anonymized.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ background: '#ef4444', borderColor: '#ef4444' }}
                    onClick={doDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
