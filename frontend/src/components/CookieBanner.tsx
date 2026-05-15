import { useState, useEffect } from 'react';
import './CookieBanner.css';

const CONSENT_KEY = 'triskelgate_consent_v1';

interface ConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  newsletters: boolean;
  timestamp: string;
  method: 'banner';
}

function getStoredConsent(): ConsentState | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveConsent(prefs: Omit<ConsentState, 'timestamp' | 'method'>): void {
  const consent: ConsentState = {
    ...prefs,
    essential: true,
    timestamp: new Date().toISOString(),
    method: 'banner',
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  // TODO: sync to API (gdpr-6)
  // if (user) fetch('/api/consent', { method: 'POST', body: JSON.stringify(consent) })
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [newsletters, setNewsletters] = useState(false);

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true, newsletters: true });
    setVisible(false);
  };

  const acceptEssential = () => {
    saveConsent({ essential: true, analytics: false, marketing: false, newsletters: false });
    setVisible(false);
  };

  const saveCustom = () => {
    saveConsent({ essential: true, analytics, marketing, newsletters });
    setVisible(false);
  };

  return (
    <div className="cookie-banner">
      {!customizing ? (
        <>
          <div className="cookie-banner__text">
            <span>🍪</span>
            <p>
              Usamos cookies para mejorar tu experiencia. Puedes aceptar todas, solo las esenciales,
              o personalizar tu elección. Consulta nuestra{' '}
              <a href="/legal/cookies">Política de Cookies</a>.
            </p>
          </div>
          <div className="cookie-banner__actions">
            <button onClick={acceptEssential} className="btn-secondary">Solo esenciales</button>
            <button onClick={() => setCustomizing(true)} className="btn-outline">Personalizar</button>
            <button onClick={acceptAll} className="btn-primary">Aceptar todo</button>
          </div>
        </>
      ) : (
        <>
          <div>
            <p><strong>Personaliza tus preferencias de cookies:</strong></p>
            <div className="cookie-banner__options">
              <label>
                <input type="checkbox" checked readOnly disabled /> Cookies esenciales (siempre activas)
              </label>
              <label>
                <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />
                Analíticas (métricas de uso anónimas)
              </label>
              <label>
                <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
                Marketing (campañas promocionales)
              </label>
              <label>
                <input type="checkbox" checked={newsletters} onChange={e => setNewsletters(e.target.checked)} />
                Newsletter (comunicaciones de X-Ops Alliance)
              </label>
            </div>
          </div>
          <div className="cookie-banner__actions">
            <button onClick={() => setCustomizing(false)} className="btn-outline">← Volver</button>
            <button onClick={saveCustom} className="btn-primary">Guardar preferencias</button>
          </div>
        </>
      )}
    </div>
  );
}
