import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/QRScanner';
import { ScanLine, Keyboard, RefreshCw } from 'lucide-react';
import './CheckIn.css';

const API_URL = import.meta.env.VITE_API_URL || '';

type CheckInState = 'idle' | 'scanning' | 'validating' | 'result';

interface ValidationResult {
  success: boolean;
  ticket?: { ticketNumber: string; holderName: string; holderEmail?: string; ticketType?: string };
  error?: string;
  message?: string;
}

interface EventOption {
  id: number;
  name: string;
  totalTickets?: number;
  validatedTickets?: number;
}

export default function CheckIn() {
  const { session } = useAuth();
  const [state, setState] = useState<CheckInState>('idle');
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch events
  useEffect(() => {
    if (!session?.access_token) return;

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/events`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch events');
        const data = await res.json();
        const eventList: EventOption[] = (data.events || []).map((e: Record<string, unknown>) => ({
          id: e.id,
          name: e.name,
          totalTickets: e.totalTickets ?? e.total_tickets ?? 0,
          validatedTickets: e.validatedTickets ?? e.validated_tickets ?? 0,
        }));
        setEvents(eventList);
        if (eventList.length > 0) {
          setSelectedEvent(String(eventList[0].id));
          setTotalTickets(eventList[0].totalTickets ?? 0);
          setScanCount(eventList[0].validatedTickets ?? 0);
        }
      } catch {
        /* events will stay empty */
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [session?.access_token]);

  // Update counters when event selection changes
  useEffect(() => {
    const ev = events.find((e) => String(e.id) === selectedEvent);
    if (ev) {
      setTotalTickets(ev.totalTickets ?? 0);
      setScanCount(ev.validatedTickets ?? 0);
    }
  }, [selectedEvent, events]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const showResult = useCallback((res: ValidationResult) => {
    setResult(res);
    setState('result');
    if (res.success) {
      setScanCount((prev) => prev + 1);
    }
    resultTimer.current = setTimeout(() => {
      setResult(null);
      setState('scanning');
    }, 3000);
  }, []);

  const validate = useCallback(
    async (code: string) => {
      if (state === 'validating' || state === 'result') return;
      if (!session?.access_token || !selectedEvent) return;

      setState('validating');

      try {
        const res = await fetch(`${API_URL}/api/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            qrCode: code,
            staffId: session.user?.id,
            eventId: selectedEvent,
          }),
        });

        const data = await res.json();

        if (data.valid) {
          showResult({
            success: true,
            ticket: data.ticket,
            message: data.message,
          });
        } else {
          showResult({
            success: false,
            error: data.error || 'Ticket inválido',
          });
        }
      } catch {
        showResult({
          success: false,
          error: 'Error de conexión. Intenta de nuevo.',
        });
      }
    },
    [state, session, selectedEvent, showResult],
  );

  const handleScan = useCallback(
    (code: string) => {
      validate(code);
    },
    [validate],
  );

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    validate(code);
  };

  const startScanning = () => {
    if (!selectedEvent) return;
    setState('scanning');
  };

  const isScanning = state === 'scanning';

  return (
    <div className="checkin-page">
      {/* Header + counter */}
      <div className="checkin-header">
        <h2>Check-in</h2>
        <div className="checkin-counter">
          <ScanLine size={16} />
          <span>Escaneados: </span>
          <span className="counter-value">
            {scanCount} / {totalTickets}
          </span>
        </div>
      </div>

      {/* Event selector */}
      <div className="checkin-event-selector">
        <label htmlFor="event-select">Evento</label>
        {loadingEvents ? (
          <div className="checkin-loading">
            <div className="spinner" />
            <span>Cargando eventos…</span>
          </div>
        ) : events.length === 0 ? (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
            No hay eventos disponibles.
          </p>
        ) : (
          <select
            id="event-select"
            value={selectedEvent}
            onChange={(e) => {
              setSelectedEvent(e.target.value);
              setState('idle');
            }}
          >
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Scanner */}
      <div className="checkin-scanner-card">
        {selectedEvent && (state === 'scanning' || state === 'validating') ? (
          <QRScanner onScan={handleScan} scanning={isScanning} />
        ) : (
          <div className="scanner-placeholder">
            <ScanLine size={48} />
            <p>{selectedEvent ? 'Presiona iniciar para escanear' : 'Selecciona un evento primero'}</p>
            {selectedEvent && (
              <button className="btn btn-primary" onClick={startScanning}>
                <ScanLine size={18} />
                Iniciar escáner
              </button>
            )}
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="checkin-manual">
        <div className="checkin-manual-label">
          <Keyboard size={14} />
          <span>Entrada manual</span>
        </div>
        <div className="checkin-manual-row">
          <input
            type="text"
            placeholder="Código del ticket…"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit();
            }}
            disabled={state === 'validating' || !selectedEvent}
          />
          <button
            className="btn btn-primary"
            onClick={handleManualSubmit}
            disabled={state === 'validating' || !manualCode.trim() || !selectedEvent}
          >
            {state === 'validating' ? <RefreshCw size={18} className="spin" /> : 'Validar'}
          </button>
        </div>
      </div>

      {/* Result overlay */}
      {state === 'result' && result && (
        <div className={`checkin-result-overlay ${result.success ? 'success' : 'failure'}`}>
          <div className="result-icon">{result.success ? '✅' : '❌'}</div>
          {result.success && result.ticket ? (
            <>
              <div className="result-name">{result.ticket.holderName}</div>
              {result.ticket.ticketType && (
                <div className="result-detail">{result.ticket.ticketType}</div>
              )}
              <div className="result-ticket-number">{result.ticket.ticketNumber}</div>
            </>
          ) : (
            <div className="result-error">{result.error}</div>
          )}
          <div className="result-countdown">Volviendo al escáner…</div>
        </div>
      )}
    </div>
  );
}
