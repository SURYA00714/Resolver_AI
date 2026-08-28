'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
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
} from 'lucide-react';
import Link from 'next/link';

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
  const resolutionRate = totalIntents > 0 ? ((capturedCount / totalIntents) * 100).toFixed(1) : '—';

  const fin = stats?.financial_summary || {};
  const netEffect = fin.net_effect ? `₹${parseFloat(fin.net_effect).toLocaleString('en-IN')}` : '₹0.00';
  const totalCaptured = fin.total_captured ? `₹${parseFloat(fin.total_captured).toLocaleString('en-IN')}` : '₹0.00';
  const webhookStats = stats?.webhook_stats || {};

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
            Merchant Control Plane
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '6px' }}>
            Payment state reconciliation, webhook monitoring, and incident response.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <Link href="/payments/new" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={15} />
            Create Order
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ 
          padding: '14px 20px', marginBottom: '24px', borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', color: '#F87171'
        }}>
          <AlertTriangle size={18} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>
            <div style={{ fontSize: '0.775rem', color: '#94A3B8', marginTop: '2px' }}>
              Make sure the FastAPI backend is running: <code>http://localhost:8000</code>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <StatsCard
          title="Payment Intents"
          value={totalIntents}
          subtitle="Total processed"
          icon={CreditCard}
          color="#3B82F6"
        />
        <StatsCard
          title="Resolution Rate"
          value={`${resolutionRate}%`}
          subtitle={`${capturedCount} captured clean`}
          icon={TrendingUp}
          color="#2AB673"
        />
        <StatsCard
          title="Open Cases"
          value={stats?.open_cases || 0}
          subtitle="Require operator review"
          icon={AlertTriangle}
          color="#F59E0B"
        />
        <StatsCard
          title="Net Financial Effect"
          value={netEffect}
          subtitle={`Captured: ${totalCaptured}`}
          icon={DollarSign}
          color="#10B981"
        />
      </div>

      {/* Webhook stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '8px' }}>
              <Webhook size={18} color="#3B82F6" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFF' }}>
                {webhookStats.total_received ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Webhooks Received</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '8px' }}>
              <XCircle size={18} color="#EF4444" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFF' }}>
                {webhookStats.signature_failures ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Signature Failures</div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '8px' }}>
              <AlertTriangle size={18} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFF' }}>
                {webhookStats.dead_letter_events ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Dead-Letter Events</div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column: Live Event Feed + Razorpay External State */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Live Event Feed */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="pulse-active" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', margin: 0 }}>
                Live Webhook Feed
              </h2>
            </div>
            <Link href="/webhooks" style={{ fontSize: '0.78rem', color: '#2AB673', textDecoration: 'none', fontWeight: 600 }}>
              Full History <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(!stats?.recent_events || stats.recent_events.length === 0) ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>
                <Activity size={32} color="#1E2535" style={{ marginBottom: '12px' }} />
                <div>No events yet. Webhook events will appear here when Razorpay sends a webhook.</div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#64748B' }}>
                  Waiting for Razorpay events at <code>POST /webhook/razorpay</code>
                </div>
              </div>
            ) : (
              stats.recent_events.map((evt) => {
                const isRecent = new Date(evt.received_at) > new Date(Date.now() - 300000);
                return (
                  <div key={evt.event_id} style={{
                    padding: '10px 14px', borderRadius: '8px', background: '#0E1826',
                    border: '1px solid #1E2535', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#E2E8F0' }}>
                        {evt.event_type}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>
                        {evt.payment_intent_id?.slice(0, 16)}… · {evt.source}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: isRecent ? '#2AB673' : '#64748B', flexShrink: 0, fontWeight: isRecent ? 600 : 400 }}>
                      {isRecent ? 'LIVE' : 'STALE'} · {new Date(evt.received_at).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Razorpay External State Panel */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', margin: 0 }}>
              Razorpay External State
            </h2>
            <Link href="/settings/integration" style={{ fontSize: '0.78rem', color: '#2AB673', textDecoration: 'none', fontWeight: 600 }}>
              Verify Connectivity <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: '0.875rem' }}>
            <ShieldCheck size={32} color="#1E2535" style={{ marginBottom: '12px' }} />
            <div>External state panel shows live Razorpay verification.</div>
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#64748B' }}>
              Navigate to a payment intent and click <strong>Verify with Razorpay</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
