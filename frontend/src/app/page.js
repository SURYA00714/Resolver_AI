'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import { 
  CreditCard, 
  AlertTriangle, 
  DollarSign, 
  CheckCircle2, 
  PlusCircle, 
  RefreshCw,
  TrendingUp,
  Activity,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState(null);

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
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateDemo = async () => {
    setCreatingDemo(true);
    try {
      const res = await api.createDemoPayment();
      setDemoResult(res);
      await loadData();
    } catch (err) {
      alert(`Demo payment error: ${err.message}`);
    } finally {
      setCreatingDemo(false);
    }
  };

  const states = stats?.states_summary || {};
  const capturedCount = states.CAPTURED || 0;
  const totalIntents = stats?.total_intents || 0;
  const resolutionRate = totalIntents > 0 ? ((capturedCount / totalIntents) * 100).toFixed(1) : '100.0';

  const fin = stats?.financial_summary || {};
  const netEffect = fin.net_effect ? `₹${parseFloat(fin.net_effect).toLocaleString('en-IN')}` : '₹0.00';
  const totalCaptured = fin.total_captured ? `₹${parseFloat(fin.total_captured).toLocaleString('en-IN')}` : '₹0.00';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em' }}>
            Merchant Control Plane
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Don't guess what happened to a payment. Verify it, resolve it, and prove it.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={loadData} 
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button 
            onClick={handleCreateDemo} 
            className="btn btn-primary"
            disabled={creatingDemo}
          >
            <PlusCircle size={16} />
            {creatingDemo ? 'Creating...' : 'New Demo Payment'}
          </button>
        </div>
      </div>

      {demoResult && (
        <div className="glass-card" style={{ padding: '14px 20px', marginBottom: '24px', borderColor: 'var(--accent-primary)', background: 'rgba(42, 182, 115, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} color="#2AB673" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Demo Payment Created: <code style={{ color: '#2AB673' }}>{demoResult.payment_intent_id}</code> (₹{demoResult.amount})
              </span>
            </div>
            <Link href={`/payments/${demoResult.payment_intent_id}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
              Inspect Intent <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444' }}>
            <AlertTriangle size={20} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{error}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginLeft: '30px' }}>
            Make sure the FastAPI backend is running on <code>http://localhost:8000</code>.
          </p>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <StatsCard
          title="Total Payment Intents"
          value={totalIntents}
          subtitle="Processed by engine"
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
          title="Open Recon Cases"
          value={stats?.open_cases || 0}
          subtitle="Requires operator review"
          icon={AlertTriangle}
          color="#F59E0B"
        />
        <StatsCard
          title="Net Recovered Effect"
          value={netEffect}
          subtitle={`Total Captured: ${totalCaptured}`}
          icon={DollarSign}
          color="#10B981"
        />
      </div>

      {/* Two Column Layout: State Machine Distribution & Recent Event Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Payment State Breakdown */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
              State Distribution (15 States)
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Deterministic</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.keys(states).length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No payment intents found in database yet.
                <div style={{ marginTop: '12px' }}>
                  <button onClick={handleCreateDemo} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                    <PlusCircle size={14} /> Create First Payment Intent
                  </button>
                </div>
              </div>
            ) : (
              Object.entries(states).map(([state, count]) => {
                const percentage = totalIntents > 0 ? ((count / totalIntents) * 100).toFixed(0) : 0;
                return (
                  <div key={state} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <StatusBadge status={state} />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '3px' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Live Event Activity Feed */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#2AB673" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
                Live Ingestion Stream
              </h2>
            </div>
            <Link href="/audit" style={{ fontSize: '0.78rem', color: '#2AB673', textDecoration: 'none', fontWeight: 600 }}>
              View All →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!stats?.recent_events || stats.recent_events.length === 0) ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No events recorded yet. Webhooks or demo actions will stream here.
              </div>
            ) : (
              stats.recent_events.map((evt) => (
                <div 
                  key={evt.event_id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFF' }}>
                      {evt.event_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {evt.payment_intent_id.slice(0, 18)}... | Source: {evt.source}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(evt.received_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
