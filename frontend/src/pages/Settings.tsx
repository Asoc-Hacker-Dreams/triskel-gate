import React, { useState } from 'react';
import { CreditCard, Shield, Zap, Crown, CheckCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'billing' | 'account'>('billing');

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
    </div>
  );
};

export default Settings;
