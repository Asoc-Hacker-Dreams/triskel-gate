import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { TrendingUp, Ticket, DollarSign, Calendar, Users, CheckCircle } from 'lucide-react';
import './Dashboard.css';

interface DashboardData {
  overview: {
    totalEvents: number;
    totalTickets: number;
    totalRevenue: number;
    totalValidated: number;
    validationRate: number;
  };
  recentActivity: {
    orders: Array<{
      id: number;
      orderNumber: string;
      eventName: string;
      customerName: string;
      customerEmail: string;
      totalAmount: number;
      status: string;
      createdAt: string;
    }>;
  };
  topEvents: Array<{
    eventId: number;
    eventName: string;
    ticketCount: number;
    revenue: number;
  }>;
}

// Placeholder data for sales chart when no real data exists
const placeholderSalesData = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: 0,
    tickets: 0,
  };
});

const KPICard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  subtitle?: string;
}> = ({ title, value, icon, accent, subtitle }) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={{ backgroundColor: accent + '18', color: accent }}>
      {icon}
    </div>
    <div className="kpi-content">
      <span className="kpi-title">{title}</span>
      <span className="kpi-value">{value}</span>
      {subtitle && <span className="kpi-subtitle">{subtitle}</span>}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/admin/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setData(res.data.dashboard);
        }
      } catch (err: any) {
        setError('Could not load dashboard data. Make sure you are logged in.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  const overview = data?.overview ?? {
    totalEvents: 0,
    totalTickets: 0,
    totalRevenue: 0,
    totalValidated: 0,
    validationRate: 0,
  };

  const recentOrders = data?.recentActivity?.orders ?? [];
  const topEvents = data?.topEvents ?? [];

  const salesData = placeholderSalesData; // Will be replaced when backend sales-over-time endpoint is ready

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(val);

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Overview of your event platform performance</p>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="Gross Revenue"
          value={formatCurrency(overview.totalRevenue)}
          icon={<DollarSign size={22} />}
          accent="#10b981"
        />
        <KPICard
          title="Tickets Sold"
          value={overview.totalTickets.toLocaleString()}
          icon={<Ticket size={22} />}
          accent="#6366f1"
        />
        <KPICard
          title="Active Events"
          value={overview.totalEvents}
          icon={<Calendar size={22} />}
          accent="#f59e0b"
        />
        <KPICard
          title="Check-ins"
          value={overview.totalValidated.toLocaleString()}
          icon={<CheckCircle size={22} />}
          accent="#ef4444"
          subtitle={`${overview.validationRate}% rate`}
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Sales Over Time */}
        <div className="chart-card">
          <h3 className="chart-title">
            <TrendingUp size={18} />
            Revenue — Last 14 Days
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Events */}
        <div className="chart-card">
          <h3 className="chart-title">
            <Users size={18} />
            Top Events by Tickets
          </h3>
          {topEvents.length === 0 ? (
            <div className="chart-empty">
              <p>No event data yet</p>
            </div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topEvents} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <YAxis
                    dataKey="eventName"
                    type="category"
                    width={120}
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '13px'
                    }}
                  />
                  <Bar dataKey="ticketCount" name="Tickets" fill="#f05537" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="chart-card" style={{ marginTop: '1.5rem' }}>
        <h3 className="chart-title">Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <div className="chart-empty">
            <p>No orders yet. Create an event and start selling!</p>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Event</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td className="order-number">{order.orderNumber}</td>
                    <td>{order.eventName}</td>
                    <td>
                      <div>{order.customerName}</div>
                      <div className="order-email">{order.customerEmail}</div>
                    </td>
                    <td className="order-amount">{formatCurrency(order.totalAmount)}</td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="order-date">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
