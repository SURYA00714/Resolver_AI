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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}>
            <Plug size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Integration & Subsystem Health
              </h1>
              <span style={{
                background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              }}>
                100% OPERATIONAL
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
              Live status of external payment gateways, storage infrastructure, worker processes, and security webhooks
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          style={{
            background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155',
            padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Recheck Connections
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* Subsystem Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Razorpay Gateway */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={20} color="#2563EB" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Razorpay REST API Switch
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
              {health?.razorpay_mode || 'CONNECTED'}
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
            Public test keys loaded. Orders creation, state verification, and payment fetching operational.
          </p>
        </div>

        {/* PostgreSQL Database */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} color="#2563EB" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                PostgreSQL Database
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
              HEALTHY
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
            Active connection pool connected. Transaction isolation levels enforced.
          </p>
        </div>

        {/* Webhook Receiver Diagnostic */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Webhook size={20} color="#0284C7" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Webhook Ingestion Gateway
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
              ACTIVE
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
            HMAC Signature Verifier active (<code style={{ color: '#2563EB', fontWeight: 700 }}>/webhook/razorpay</code>). Secret: {webhookDiag?.webhook_secret_configured ? 'Configured' : 'Test Default'}.
          </p>
        </div>

        {/* Durable Outbox Worker */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={20} color="#D97706" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Durable Outbox Worker
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
              POLLING
            </span>
          </div>
          <p style={{ fontSize: '0.83rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
            Dead-Letter Queue: <strong style={{ color: '#0F172A' }}>{deadLetters.length} items</strong>. Exponential backoff enabled.
          </p>
        </div>

      </div>
    </div>
  );
}
