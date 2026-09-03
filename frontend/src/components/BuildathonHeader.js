'use client';

import { RefreshCw, PlusCircle, ShieldCheck, Activity, Eye, Zap } from 'lucide-react';
import Link from 'next/link';

export default function BuildathonHeader({ loading, loadData, isJudgeView, setIsJudgeView }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Top Bar: Title + Status + Presentation Toggle + Actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Payment State Intelligence & Reliability Command Center
            </h1>
            <span style={{
              fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.12)', color: '#4ADE80',
              border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px'
            }}>
              <span className="pulse-active" style={{ width: '6px', height: '6px' }} />
              RAZORPAY BUILDATHON DEMO ENGINE
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Autonomous payment state resolution, policy-enforced ledger reconciliation, and real-time evidence trail.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsJudgeView(!isJudgeView)}
            className={`btn ${isJudgeView ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', gap: '6px' }}
          >
            <Eye size={14} />
            {isJudgeView ? 'Exit Judge Mode' : 'Buildathon Judge Mode'}
          </button>

          <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.8rem', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <Link href="/payments/new" className="btn btn-primary" style={{ fontSize: '0.8rem', gap: '6px' }}>
            <PlusCircle size={14} />
            Simulate Checkout
          </Link>
        </div>
      </div>

      {/* Lifecycle Banner: PAYMENT -> EVENTS -> STATE -> EVIDENCE -> AI -> POLICY -> RESOLUTION -> AUDIT */}
      <div className="glass-card" style={{ padding: '14px 20px', background: 'var(--bg-surface-hover)' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          DETERMINISTIC ARCHITECTURAL LIFECYCLE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { label: '1. PAYMENT', desc: 'Merchant Order' },
            { label: '2. EVENTS', desc: 'HMAC Webhooks' },
            { label: '3. STATE', desc: 'State Machine' },
            { label: '4. EVIDENCE', desc: 'Immutable Hash' },
            { label: '5. AI ANALYSIS', desc: 'Advisory Hypothesis' },
            { label: '6. POLICY', desc: 'Financial Safety' },
            { label: '7. RESOLUTION', desc: 'Auto Recovery' },
            { label: '8. AUDIT', desc: 'Proven Ledger' },
          ].map((step, idx, arr) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{step.label}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{step.desc}</div>
              </div>
              {idx < arr.length - 1 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
