'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { FlaskConical, AlertTriangle, Zap, ShieldAlert, ArrowRight, Play } from 'lucide-react';
import Link from 'next/link';

export default function EngineeringChaosLabPage() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleInjectChaos = async (scenarioType) => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await api.injectChaos(scenarioType);
      setLastResult(res);
    } catch (err) {
      alert(`Chaos Injection Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Explicit Warning Header Banner */}
      <div style={{
        padding: '18px 24px', borderRadius: '12px', marginBottom: '28px',
        background: 'rgba(245, 158, 11, 0.1)', border: '2px dashed rgba(245, 158, 11, 0.4)',
        display: 'flex', alignItems: 'center', gap: '14px', color: '#FBBF24',
      }}>
        <AlertTriangle size={28} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.04em' }}>
            ⚠ ENGINEERING CHAOS LAB — LOCAL SIMULATION MODE
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            All triggers in this workspace generate local test events. NO real Razorpay merchant financial funds or webhooks are affected.
          </div>
        </div>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <FlaskConical size={24} color="#FB923C" />
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
          Chaos & Scenario Injection Lab
        </h1>
      </div>

      {/* Scenario Triggers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Simulate Delayed Webhook
            </h3>
            <ProvenanceBadge type="LOCAL_SIMULATION" size="small" />
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Creates a payment intent stuck in AUTHORIZED state, then injects a late `payment.captured` event.
          </p>
          <button
            onClick={() => handleInjectChaos('delayed_webhook')}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <Play size={14} /> Inject Delayed Webhook
          </button>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Simulate Duplicate Webhook
            </h3>
            <ProvenanceBadge type="LOCAL_SIMULATION" size="small" />
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Sends identical external event ID twice to test idempotent event deduplication.
          </p>
          <button
            onClick={() => handleInjectChaos('duplicate_webhook')}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <Play size={14} /> Inject Duplicate Event
          </button>
        </div>

        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Simulate Signature Tampering
            </h3>
            <ProvenanceBadge type="LOCAL_SIMULATION" size="small" />
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Sends request with invalid HMAC signature to verify 401 Unauthorized rejection.
          </p>
          <button
            onClick={() => handleInjectChaos('tampered_signature')}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <Play size={14} /> Inject Tampered Signature
          </button>
        </div>
      </div>

      {/* Result Panel */}
      {lastResult && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontWeight: 700, color: '#FB923C', fontSize: '0.95rem' }}>
              Chaos Scenario Execution Result
            </div>
            {lastResult.payment_intent_id && (
              <Link href={`/payments/${lastResult.payment_intent_id}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                Inspect Intent <ArrowRight size={13} />
              </Link>
            )}
          </div>
          <pre style={{ margin: 0, padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.78rem', color: '#60A5FA', overflowX: 'auto' }}>
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
