'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Flame, Zap, ShieldAlert, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ChaosLabPage() {
  const [injecting, setInjecting] = useState(null);
  const [result, setResult] = useState(null);

  const handleInject = async (type) => {
    setInjecting(type);
    setResult(null);
    try {
      const res = await api.injectChaos(type);
      setResult({ type, data: res });
    } catch (err) {
      alert(`Chaos injection error: ${err.message}`);
    } finally {
      setInjecting(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Flame size={24} color="#F59E0B" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFF' }}>
            Local Chaos Test Laboratory
          </h1>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Safely simulate payment failures, duplicate executions, and delayed webhooks to test 5-rule policy enforcement.
        </p>
      </div>

      {/* 3 Fault Scenarios Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Fault 1: Late Authorization */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={20} color="#F59E0B" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
                Late Authorization (UPI)
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Simulates a UPI payment that timed out in the browser, but was authorized 5 minutes later at the bank switch.
            </p>
          </div>

          <button
            onClick={() => handleInject('late-auth')}
            disabled={injecting === 'late-auth'}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            {injecting === 'late-auth' ? 'Injecting Fault...' : 'Inject Late Authorization Fault'}
          </button>
        </div>

        {/* Fault 2: Cross-Rail Duplicate */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={20} color="#EC4899" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
                Duplicate Execution
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Simulates a retry storm where two separate rails capture funds for the exact same merchant order ID.
            </p>
          </div>

          <button
            onClick={() => handleInject('cross-rail')}
            disabled={injecting === 'cross-rail'}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            {injecting === 'cross-rail' ? 'Injecting Fault...' : 'Inject Duplicate Execution Fault'}
          </button>
        </div>

        {/* Fault 3: Out-of-Order Webhook */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={20} color="#3B82F6" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF' }}>
                Out-of-Order Webhook
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Delivers <code>payment.captured</code> webhook BEFORE the merchant core system receives <code>order.created</code>.
            </p>
          </div>

          <button
            onClick={() => handleInject('out-of-order')}
            disabled={injecting === 'out-of-order'}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            {injecting === 'out-of-order' ? 'Injecting Fault...' : 'Inject Out-of-Order Webhook Fault'}
          </button>
        </div>
      </div>

      {/* Fault Result Panel */}
      {result && (
        <div className="glass-card" style={{ padding: '24px', borderColor: '#2AB673' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <CheckCircle2 size={20} color="#2AB673" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF' }}>
              Fault Injected Successfully ({result.type.toUpperCase()})
            </h3>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            The ResolverAI engine captured this anomaly and created an operational intent for policy evaluation.
          </p>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {result.data.payment_intent_id && (
              <Link href={`/payments/${result.data.payment_intent_id}`} className="btn btn-primary">
                Inspect Intent & Evidence <ArrowRight size={16} />
              </Link>
            )}
          </div>

          <pre style={{
            marginTop: '16px',
            padding: '14px',
            background: 'var(--bg-primary)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: '#A7F3D0',
            overflowX: 'auto',
          }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
