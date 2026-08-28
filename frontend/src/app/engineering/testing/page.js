'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { FlaskConical, Zap, ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';
import Link from 'next/link';

export default function EngineeringTestingPage() {
  const [injecting, setInjecting] = useState(null);
  const [result, setResult] = useState(null);

  const handleInject = async (type) => {
    setInjecting(type);
    setResult(null);
    try {
      const res = await api.injectChaos(type);
      setResult({ type, data: res });
    } catch (err) {
      if (err.message?.includes('403') || err.message?.includes('production')) {
        alert('Chaos injection is disabled in production. This tool is for LOCAL ENGINEERING environments only.');
      } else {
        alert(`Chaos injection error: ${err.message}`);
      }
    } finally {
      setInjecting(null);
    }
  };

  return (
    <div>
      {/* Engineering Warning Banner */}
      <div style={{
        padding: '14px 20px', marginBottom: '28px', borderRadius: '10px',
        background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.25)',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <AlertTriangle size={18} color="#FB923C" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, color: '#FB923C', fontSize: '0.9rem' }}>
            LOCAL ENGINEERING TEST ENVIRONMENT ONLY
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '4px' }}>
            These actions inject SYNTHETIC data into the database to test the resolution pipeline.
            They do NOT create real Razorpay payments. Disabled in production.
            Routes: <code>POST /engineering/chaos/*</code>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <FlaskConical size={22} color="#FB923C" />
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
          Chaos Test Lab
        </h1>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '28px' }}>
        Inject synthetic payment anomaly scenarios to verify the resolution pipeline.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {[
          {
            type: 'late-auth', icon: <Zap size={20} color="#F59E0B" />, bg: 'rgba(245, 158, 11, 0.12)',
            title: 'Late Authorization (UPI)',
            desc: 'Injects a UPI payment that timed out in the browser but was authorized at the bank switch. Tests the UNCERTAIN→CAPTURED resolution path.',
          },
          {
            type: 'cross-rail', icon: <ShieldAlert size={20} color="#EC4899" />, bg: 'rgba(236, 72, 153, 0.12)',
            title: 'Cross-Rail Duplicate',
            desc: 'Simulates dual-rail capture where two rails attempt to capture the same order. Tests DUPLICATE_SUSPECTED→REFUND resolution.',
          },
          {
            type: 'out-of-order', icon: <Flame size={20} color="#3B82F6" />, bg: 'rgba(59, 130, 246, 0.12)',
            title: 'Out-of-Order Webhook',
            desc: 'Delivers payment.captured before order.created. Tests idempotency and webhook ordering resilience.',
          },
        ].map(({ type, icon, bg, title, desc }) => (
          <div key={type} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {icon}
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', margin: 0 }}>{title}</h2>
              </div>
              <p style={{ fontSize: '0.84rem', color: '#64748B', marginBottom: '20px', lineHeight: '1.55' }}>{desc}</p>
            </div>

            <button
              onClick={() => handleInject(type)}
              disabled={!!injecting}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              {injecting === type ? 'Injecting...' : `Inject ${title} Scenario`}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="glass-card" style={{ padding: '24px', borderColor: 'rgba(42, 182, 115, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <CheckCircle2 size={18} color="#2AB673" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#FFF', margin: 0 }}>
              Scenario Injected: {result.type.toUpperCase()}
            </h3>
          </div>

          <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.15)', fontSize: '0.8rem', color: '#FBBF24' }}>
            {result.data._banner?.warning || 'SYNTHETIC DATA — NOT from Razorpay'}
          </div>

          {result.data.injected?.payment_intent_id && (
            <div style={{ marginBottom: '16px' }}>
              <Link href={`/payments/${result.data.injected.payment_intent_id}`} className="btn btn-primary">
                View Resolution Pipeline <ArrowRight size={14} />
              </Link>
            </div>
          )}

          <pre style={{ padding: '14px', background: '#0A0F1A', borderRadius: '8px', fontSize: '0.78rem', color: '#94A3B8', overflowX: 'auto', margin: 0 }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
