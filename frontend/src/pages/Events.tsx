import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreHorizontal } from 'lucide-react';
import axios from 'axios';

interface EventData {
  id: number;
  name: string;
  startDate: string;
  status: string;
  slug: string;
}

const Events: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We will replace this with real fetch once backend is secured
    const fetchEvents = async () => {
      try {
        const response = await axios.get('/api/events');
        setEvents(response.data);
      } catch (err) {
        console.error('Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, []);

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1>Events</h1>
        <button className="btn btn-primary" onClick={() => navigate('/events/create')}>
          <Plus size={20} />
          <span>Create Event</span>
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>No events yet</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>Create your first event to start selling tickets.</p>
            <button className="btn btn-primary" onClick={() => navigate('/events/create')}>Create Event</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', backgroundColor: 'var(--color-surface-hover)' }}>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Event</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{event.name}</td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--color-text-secondary)' }}>{new Date(event.startDate).toLocaleDateString()}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      backgroundColor: event.status === 'active' ? 'var(--color-success-bg)' : 'var(--color-border)',
                      color: event.status === 'active' ? 'var(--color-success)' : 'var(--color-text-secondary)'
                    }}>
                      {event.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <button className="btn btn-ghost" style={{ padding: '0.5rem' }}><MoreHorizontal size={20} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Events;
