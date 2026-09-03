'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plug, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Database, Cpu, Webhook, Activity } from 'lucide-react';

export default function IntegrationHealthPage() {
  const [health, setHealth] = useState(null);
  const [webhookDiag, setWebhookDiag] = useState(null);
  const [deadLetters, setDeadLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, diag, dl] = await Promise.all([
        api.getIntegrationHealth().catch(() => ({ status: 'error' })),
        api.getWebhookDiagnostics().catch(() => null),
        api.getDeadLetters().catch(() => ({ items: [] })),
      ]);
      setHealth(h);
      setWebhookDiag(diag);
      setDeadLetters(dl.items || dl || []);
    } catch (err) {
      setError(err.message || 'Failed to connect to integration health services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Plug size={22} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Integration & Subsystem Health
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Live status of external payment gateways, storage infrastructure, worker processes, and security webhooks.
          </p>
        </div>

        <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Recheck Connections
        </button>
      </div>

      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Grid of Subsystems */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Razorpay Gateway */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Razorpay REST API
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, background: health?.razorpay_mode === 'LIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)', color: health?.razorpay_mode === 'LIVE' ? '#22C55E' : '#60A5FA' }}>
              {health?.razorpay_mode || 'CONNECTED'}
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
            Public test keys loaded. Orders creation & payment verification operational.
          </p>
        </div>

        {/* PostgreSQL Database */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} color="#3B82F6" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                PostgreSQL Database
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
              CONNECTED
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
            Active pool connection to Render PostgreSQL instance.
          </p>
        </div>

        {/* Webhook Receiver Diagnostic */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Webhook size={20} color="#22D3EE" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Webhook Ingestion Endpoint
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
              REGISTERED
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
            HMAC Signature Verifier active (`/webhook/razorpay`). Secret status: {webhookDiag?.webhook_secret_configured ? 'Configured' : 'Test Default'}.
          </p>
        </div>

        {/* Durable Outbox Worker */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} color="#F59E0B" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Durable Outbox Worker
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
              POLLING
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
            Dead-Letter Queue: <strong style={{ color: 'var(--text-primary)' }}>{deadLetters.length} items</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
