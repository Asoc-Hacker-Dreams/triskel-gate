import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CreateEvent: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
    ticket_name: 'General Admission',
    ticket_price: '0.00',
    ticket_quantity: '100'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Event
      const eventRes = await axios.post('/admin/events', {
        name: formData.name,
        location: formData.location,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        description: formData.description,
        platformFeePercent: 3.0
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // 2. Create Ticket Type
      await axios.post('/admin/ticket-types', {
        eventId: eventRes.data.id,
        name: formData.ticket_name,
        price: parseFloat(formData.ticket_price),
        maxQuantity: parseInt(formData.ticket_quantity, 10),
        saleStartDate: new Date().toISOString(),
        saleEndDate: new Date(formData.start_date).toISOString()
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      navigate('/events');
    } catch (err) {
      console.error(err);
      alert('Failed to create event. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1>Create Event</h1>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Step {step} of 2</div>
      </div>

      <div className="card">
        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          
          {step === 1 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label>Event Name</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Summer Music Festival" />
              </div>
              
              <div>
                <label>Location</label>
                <input required type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Venue or Online Link" />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Starts</label>
                  <input required type="datetime-local" name="start_date" value={formData.start_date} onChange={handleChange} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Ends</label>
                  <input required type="datetime-local" name="end_date" value={formData.end_date} onChange={handleChange} />
                </div>
              </div>

              <div>
                <label>Description</label>
                <textarea rows={4} name="description" value={formData.description} onChange={handleChange} placeholder="Write a short summary..."></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save & Continue</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3>First Ticket Type</h3>
              <p style={{ color: 'var(--color-text-secondary)' }}>You can add more ticket types later.</p>

              <div>
                <label>Ticket Name</label>
                <input required type="text" name="ticket_name" value={formData.ticket_name} onChange={handleChange} />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Price ($)</label>
                  <input required type="number" step="0.01" min="0" name="ticket_price" value={formData.ticket_price} onChange={handleChange} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Quantity Available</label>
                  <input required type="number" min="1" name="ticket_quantity" value={formData.ticket_quantity} onChange={handleChange} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleBack}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default CreateEvent;
