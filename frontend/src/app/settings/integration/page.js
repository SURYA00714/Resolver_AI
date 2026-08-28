'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plug, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';

function StatusBubble({ status }) {
  const config = {
    CONNECTED: { bg: 'rgba(42, 182, 115, 0.1)', color: '#2AB673', icon: <CheckCircle2 size={15} /> },
    SYNTHETIC: { bg: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', icon: <AlertTriangle size={15} /> },
    DISCONNECTED: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', icon: <XCircle size={15} /> },
    DEGRADED: { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', icon: <AlertTriangle size={15} /> },
    NOT_CONFIGURED: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B', icon: <XCircle size={15} /> },
    ACTIVE: { bg: 'rgba(42, 182, 115, 0.1)', color: '#2AB673', icon: <CheckCircle2 size={15} /> },
    DETERMINISTIC: { bg: 'rgba(59, 130, 246, 0.1)', color: '#60A5FA', icon: <CheckCircle2 size={15} /> },
    UNAVAILABLE: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', icon: <XCircle size={15} /> },
    UNKNOWN: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748B', icon: <AlertTriangle size={15} /> },
  };
  const c = config[status] || config.UNKNOWN;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: c.bg, color: c.color, fontSize: '0.82rem', fontWeight: 600 }}>
      {c.icon} {status}
    </span>
  );
}

function HealthSection({ title, data }) {
  if (!data) return null;
  const status = data.status || 'UNKNOWN';
  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid #1E2535' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: data.message || data.mode ? '12px' : '0' }}>
        <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.95rem' }}>{title}</div>
        <StatusBubble status={status} />
      </div>
      {data.message && <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '6px' }}>{data.message}</div>}
      {data.mode && <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Mode: <code style={{ color: '#94A3B8' }}>{data.mode}</code></div>}
      {data.key_id && <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Key ID: <code style={{ color: '#94A3B8' }}>{data.key_id}</code></div>}
      {data.description && <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>{data.description}</div>}
    </div>
  );
}

export default function IntegrationPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await api.getIntegrationHealth();
      setHealth(h);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: '720px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Plug size={22} color="#2AB673" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
              Integration Health
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            Real-time connectivity check against Razorpay API, database, Redis, and the outbox worker.
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Re-check
        </button>
      </div>

      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {health && (
        <>
          {/* Top-level metadata */}
          <div style={{ padding: '14px 20px', marginBottom: '20px', borderRadius: '10px', background: '#0A0F1A', border: '1px solid #1E2535', display: 'flex', gap: '24px', fontSize: '0.8rem', color: '#64748B' }}>
            <span>Environment: <code style={{ color: '#94A3B8' }}>{health.environment}</code></span>
            <span>Checked: <code style={{ color: '#94A3B8' }}>{new Date(health.ts).toLocaleString()}</code></span>
            <span>Razorpay Mode: <code style={{ color: '#2AB673' }}>{health.razorpay_mode}</code></span>
          </div>

          <div className="glass-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
            <HealthSection title="Razorpay API" data={health.razorpay} />
            <HealthSection title="PostgreSQL Database" data={health.database} />
            <HealthSection title="Redis" data={health.redis} />
            <HealthSection title="AI / Evidence Provider" data={health.ai_provider} />

            {health.outbox_worker && (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontWeight: 600, color: '#E2E8F0', fontSize: '0.95rem', marginBottom: '12px' }}>Outbox Worker</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Pending Events', value: health.outbox_worker.pending_events ?? '—' },
                    { label: 'Dead Letters', value: health.outbox_worker.dead_letter_events ?? '—' },
                    { label: 'Last Processed', value: health.outbox_worker.last_processed_at ? new Date(health.outbox_worker.last_processed_at).toLocaleTimeString() : 'Never' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '12px', background: '#0A0F1A', borderRadius: '8px', border: '1px solid #1E2535' }}>
                      <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#E2E8F0' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Setup instructions if not configured */}
          {health.razorpay?.status === 'NOT_CONFIGURED' && (
            <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.06)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
              <div style={{ fontWeight: 600, color: '#FBBF24', marginBottom: '12px' }}>Configure Razorpay Integration</div>
              <div style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '12px' }}>
                Add the following to your <code>.env</code> file in the backend directory:
              </div>
              <pre style={{ background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px', padding: '14px 16px', fontSize: '0.82rem', color: '#2AB673', margin: 0, overflowX: 'auto' }}>
{`RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_secret_here
RAZORPAY_MODE=TEST
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret`}
              </pre>
              <div style={{ marginTop: '14px' }}>
                <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#2AB673', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                  Get API keys from Razorpay Dashboard <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {loading && !health && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#475569' }}>
          <RefreshCw size={32} color="#1E2535" className="spin" style={{ marginBottom: '12px' }} />
          <div>Checking integration health...</div>
        </div>
      )}
    </div>
  );
}
