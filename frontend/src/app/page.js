'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import {
  CreditCard,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Activity,
  Webhook,
  XCircle,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const STATE_COLORS = {
  CAPTURED: '#22C55E',
  AUTHORIZED: '#3B82F6',
  UNCERTAIN: '#F59E0B',
  FAILED: '#EF4444',
  DUPLICATE_SUSPECTED: '#EC4899',
  MANUAL_REVIEW: '#A855F7',
  RECONCILED: '#10B981',
  CREATED: '#64748B',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to ResolverAI backend engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const states = stats?.states_summary || {};
  const capturedCount = states.CAPTURED || 0;
  const totalIntents = stats?.total_intents || 0;
  const resolutionRate = totalIntents > 0 ? ((capturedCount / totalIntents) * 100).toFixed(1) : '0.0';

  const fin = stats?.financial_summary || {};
  const netEffect = fin.net_effect ? `₹${parseFloat(fin.net_effect).toLocaleString('en-IN')}` : '₹0.00';
  const totalCaptured = fin.total_captured ? `₹${parseFloat(fin.total_captured).toLocaleString('en-IN')}` : '₹0.00';
  const webhookStats = stats?.webhook_stats || {};

  const chartData = Object.entries(states).map(([name, value]) => ({
    name,
    value,
    color: STATE_COLORS[name] || '#64748B',
  }));

  return (
    <div>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Payment Integrity Command Center
            </h1>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--badge-real-bg)', color: 'var(--badge-real-text)', border: '1px solid var(--badge-real-border)', fontWeight: 700 }}>
              AUTONOMOUS ENGINE ACTIVE
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time Razorpay state reconciliation, immutable evidence trail, and automated recovery pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <Link href="/payments/new" className="btn btn-primary">
            <PlusCircle size={15} />
            Create Order & Pay
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '14px 20px', marginBottom: '24px', borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', color: '#F87171',
        }}>
          <AlertTriangle size={18} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Ensure the ResolverAI FastAPI service is active and database is connected.
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <StatsCard
          title="Payment Intents"
          value={totalIntents}
          subtitle="Total intents processed"
          icon={CreditCard}
          color="#3B82F6"
        />
        <StatsCard
          title="Resolution Rate"
          value={`${resolutionRate}%`}
          subtitle={`${capturedCount} captured clean`}
          icon={TrendingUp}
          color="var(--accent-primary)"
        />
        <StatsCard
          title="Unresolved Cases"
          value={stats?.open_cases || 0}
          subtitle="Requires operator review"
          icon={AlertTriangle}
          color="#F59E0B"
        />
        <StatsCard
          title="Net Financial Effect"
          value={netEffect}
          subtitle={`Total Captured: ${totalCaptured}`}
          icon={DollarSign}
          color="#10B981"
        />
      </div>

      {/* Webhook Operational Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '8px' }}>
              <Webhook size={18} color="#3B82F6" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {webhookStats.total_received ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Webhooks Ingested</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px' }}>
              <XCircle size={18} color="#EF4444" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {webhookStats.signature_failures ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signature Rejections</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '8px' }}>
              <AlertTriangle size={18} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {webhookStats.dead_letter_events ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dead-Letter Outbox</div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Row: Analytics Chart + Live Event Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Payment State Distribution Analytics Chart */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Payment State Breakdown
            </h2>
            <Link href="/payments" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Registry View <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          {chartData.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No state distribution data available. Create an order to begin.
            </div>
          ) : (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Live Webhook Feed */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-active" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Live Webhook Stream
              </h2>
            </div>
            <Link href="/webhooks" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Observability Console <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!stats?.recent_events || stats.recent_events.length === 0) ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Activity size={32} color="var(--border-color)" style={{ marginBottom: '12px' }} />
                <div>No events yet. Incoming webhooks will stream here automatically.</div>
              </div>
            ) : (
              stats.recent_events.slice(0, 5).map((evt) => {
                const isRecent = new Date(evt.received_at) > new Date(Date.now() - 300000);
                return (
                  <div key={evt.event_id} style={{
                    padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{evt.event_type}</span>
                        <ProvenanceBadge type={evt.source === 'RAZORPAY' ? 'REAL_WEBHOOK' : 'LOCAL_SIMULATION'} size="small" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                        {evt.payment_intent_id?.slice(0, 18)}…
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: isRecent ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {new Date(evt.received_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
