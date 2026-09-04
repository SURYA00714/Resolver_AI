'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  FlaskConical,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Clock,
  Copy,
  Zap,
} from 'lucide-react';
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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Test Environment Safety Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning)',
        borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} />
          <span>ISOLATED TEST HARNESS: Chaos operations are scoped to mock webhooks and have ₹0.00 financial effect.</span>
        </div>
      </div>

      {/* Header Banner */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'var(--brand-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}>
            <FlaskConical size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Chaos & Edge-Case Injection Lab
            </h1>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
              Inject real-world network delays, duplicate webhooks, and tampered signatures to verify system resilience
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Triggers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Scenario 1 */}
        <div className="card" style={{
          padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Simulate Delayed Webhook
              </h3>
              <span className="badge badge-info">
                LATE CAPTURE
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Creates a payment intent stuck in <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>AUTHORIZED</code> state, then injects a delayed <code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>payment.captured</code> webhook to verify late state resolution.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('delayed_webhook')}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 16px', fontSize: '0.875rem' }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Inject Delayed Webhook
          </button>
        </div>

        {/* Scenario 2 */}
        <div className="card" style={{
          padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Simulate Duplicate Event
              </h3>
              <span className="badge badge-neutral">
                IDEMPOTENCY
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Fires identical external webhook ID twice concurrently to verify deterministic idempotency deduplication and zero double-processing.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('duplicate_webhook')}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px 16px', fontSize: '0.875rem' }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Inject Duplicate Event
          </button>
        </div>

        {/* Scenario 3 */}
        <div className="card" style={{
          padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Simulate Signature Tampering
              </h3>
              <span className="badge badge-danger">
                SECURITY REJECTION
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Sends a modified payload with invalid HMAC signature to verify immediate <code style={{ color: 'var(--color-danger)', fontWeight: 700 }}>401 Unauthorized</code> rejection by security gateway.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('tampered_signature')}
            disabled={loading}
            className="btn btn-danger"
            style={{ width: '100%', padding: '10px 16px', fontSize: '0.875rem' }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Inject Tampered Signature
          </button>
        </div>

      </div>

      {/* Result Panel */}
      {lastResult && (() => {
        const intentId = lastResult.payment_intent_id || lastResult.injected?.payment_intent_id;
        return (
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="var(--color-success)" />
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>
                  Chaos Scenario Execution Result
                </span>
              </div>
              {intentId && (
                <Link
                  href={`/payments/${intentId}`}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Inspect Intent <ArrowRight size={14} />
                </Link>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              <Terminal size={14} /> Raw Execution Payload & State Trace
            </div>

            <pre style={{
              margin: 0, padding: '16px', background: 'var(--bg-input)', borderRadius: '8px',
              fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)',
              overflowX: 'auto', border: '1px solid var(--border-color)', lineHeight: '1.5',
            }}>
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        );
      })()}
    </div>
  );
}
