'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { FlaskConical, AlertTriangle, Zap, ShieldAlert, ArrowRight, Play, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sandbox Safety Banner */}
      <div style={{
        padding: '16px 20px', borderRadius: '10px',
        background: '#FEF3C7', border: '1px solid #FDE047',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#B45309',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} style={{ flexShrink: 0, color: '#D97706' }} />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.02em', color: '#92400E' }}>
              CHAOS & FAILURE INJECTION LAB — ISOLATED LOCAL SIMULATION
            </div>
            <div style={{ fontSize: '0.8rem', color: '#B45309', marginTop: '2px' }}>
              All chaos triggers inject synthetic test events. <strong>₹0.00 Real Merchant Funds Affected.</strong> Deterministic Policy Engine active.
            </div>
          </div>
        </div>
        <span style={{
          background: '#FFFFFF', border: '1px solid #FCD34D', color: '#92400E',
          fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
        }}>
          SAFE ENVIRONMENT
        </span>
      </div>

      {/* Page Title & Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
          }}>
            <FlaskConical size={22} color="#FFFFFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              Chaos & Edge-Case Injection Lab
            </h1>
            <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
              Inject real-world network delays, duplicate webhooks, and tampered signatures to verify system resilience
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Triggers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Scenario 1 */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Simulate Delayed Webhook
              </h3>
              <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                LATE CAPTURE
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Creates a payment intent stuck in <code style={{ color: '#2563EB', fontWeight: 700 }}>AUTHORIZED</code> state, then injects a delayed <code style={{ color: '#2563EB', fontWeight: 700 }}>payment.captured</code> webhook to verify late state resolution.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('delayed_webhook')}
            disabled={loading}
            style={{
              width: '100%', background: '#2563EB', border: 'none', color: '#FFFFFF',
              padding: '10px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Inject Delayed Webhook
          </button>
        </div>

        {/* Scenario 2 */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Simulate Duplicate Event
              </h3>
              <span style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                IDEMPOTENCY
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Fires identical external webhook ID twice concurrently to verify deterministic idempotency deduplication and zero double-processing.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('duplicate_webhook')}
            disabled={loading}
            style={{
              width: '100%', background: '#0F172A', border: 'none', color: '#FFFFFF',
              padding: '10px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
            Inject Duplicate Event
          </button>
        </div>

        {/* Scenario 3 */}
        <div style={{
          background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Simulate Signature Tampering
              </h3>
              <span style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                SECURITY REJECTION
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Sends a modified payload with invalid HMAC signature to verify immediate <code style={{ color: '#DC2626', fontWeight: 700 }}>401 Unauthorized</code> rejection by security gateway.
            </p>
          </div>
          <button
            onClick={() => handleInjectChaos('tampered_signature')}
            disabled={loading}
            style={{
              width: '100%', background: '#DC2626', border: 'none', color: '#FFFFFF',
              padding: '10px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
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
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem' }}>
                  Chaos Scenario Execution Result
                </span>
              </div>
              {intentId && (
                <Link
                  href={`/payments/${intentId}`}
                  style={{
                    background: '#2563EB', color: '#FFFFFF', padding: '6px 14px', borderRadius: '6px',
                    fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  Inspect Intent <ArrowRight size={14} />
                </Link>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              <Terminal size={14} /> Raw Execution Payload & State Trace
            </div>

            <pre style={{
              margin: 0, padding: '16px', background: '#0F172A', borderRadius: '8px',
              fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', color: '#38BDF8',
              overflowX: 'auto', border: '1px solid #1E293B', lineHeight: '1.5',
            }}>
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        );
      })()}
    </div>
  );
}

