import React, { useState, useEffect } from 'react';
import { Ticket } from 'lucide-react';
import axios from 'axios';
import './CheckIn.css';

interface TicketTypeOption {
  id: number;
  name: string;
  price: number;
  maxQuantity: number;
}

interface EventInfo {
  id: number;
  name: string;
  startDate: string;
  location: string;
}

const Checkout: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const eventIdParam = params.get('eventId');
  const ticketTypeIdParam = params.get('ticketTypeId');

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState(ticketTypeIdParam || '');
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (!eventIdParam) return;
    const fetchData = async () => {
      try {
        const [evRes, ttRes] = await Promise.all([
          axios.get(`/api/events/${eventIdParam}`),
          axios.get(`/api/events/${eventIdParam}/ticket-types`),
        ]);
        setEvent(evRes.data.data);
        setTicketTypes(ttRes.data.data || []);
        if (!selectedTicketTypeId && ttRes.data.data?.length > 0) {
          setSelectedTicketTypeId(String(ttRes.data.data[0].id));
        }
      } catch {
        setError('No se pudo cargar la información del evento.');
      }
    };
    fetchData();
  }, [eventIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!eventIdParam || !selectedTicketTypeId) {
      setError('Falta información del evento o tipo de ticket.');
      return;
    }
    setLoading(true);
    try {
      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = window.location.href;

      const res = await axios.post('/api/payment/create-session', {
        eventId: parseInt(eventIdParam, 10),
        ticketTypeId: parseInt(selectedTicketTypeId, 10),
        quantity,
        customerEmail,
        customerName,
        customerPhone: customerPhone || undefined,
        successUrl,
        cancelUrl,
        metadata: {
          buyer_email: customerEmail,
          newsletter_consent: String(newsletterConsent),
          marketing_consent: String(marketingConsent),
        },
      });

      if (res.data.success && res.data.sessionUrl) {
        window.location.href = res.data.sessionUrl;
      } else {
        setError(res.data.message || 'Error al crear la sesión de pago.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background, #f9fafb)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <Ticket size={32} color="#f05537" />
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Triskell Gate</h1>
        </div>

        {event && (
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{event.name}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              {new Date(event.startDate).toLocaleDateString('es-ES', { dateStyle: 'long' })} · {event.location}
            </p>
          </div>
        )}

        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Comprar Entradas</h2>

          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Nombre completo *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Email *</label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="tu@email.com"
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Teléfono (opcional)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+34 600 000 000"
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            {ticketTypes.length > 1 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Tipo de entrada *</label>
                <select
                  value={selectedTicketTypeId}
                  onChange={e => setSelectedTicketTypeId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                >
                  {ticketTypes.map(tt => (
                    <option key={tt.id} value={tt.id}>{tt.name} — {tt.price}€</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Cantidad *</label>
              <input
                type="number"
                required
                min={1}
                max={10}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value, 10))}
                style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* GDPR consent section */}
            <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
                Comunicaciones (opcional)
              </p>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newsletterConsent}
                  onChange={e => setNewsletterConsent(e.target.checked)}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.85rem', lineHeight: 1.4, color: '#555' }}>
                  Acepto recibir el newsletter de Triskell Gate con noticias sobre eventos,
                  nuevas funcionalidades y contenido exclusivo para organizadores.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.85rem', lineHeight: 1.4, color: '#555' }}>
                  Acepto recibir comunicaciones de marketing sobre eventos recomendados y
                  ofertas especiales. Puedes cancelar en cualquier momento.
                </span>
              </label>

              <p style={{ fontSize: '0.8rem', color: '#777', marginTop: '0.5rem' }}>
                Tus datos son tratados conforme al RGPD. Consulta nuestra{' '}
                <a href="/privacy" style={{ color: '#f05537' }}>política de privacidad</a>.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Procesando...' : 'Continuar al pago →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
