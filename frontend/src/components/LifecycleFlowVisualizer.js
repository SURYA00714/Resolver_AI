'use client';

import { Activity, GitMerge, ArrowRight, ShieldCheck, Cpu, Zap, AlertTriangle } from 'lucide-react';

export default function LifecycleFlowVisualizer() {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitMerge size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Payment State Lifecycle & Resolution Pipeline
          </h2>
        </div>
        <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', fontWeight: 800 }}>
          DETERMINISTIC STATE MACHINE
        </span>
      </div>

      {/* Main Lifecycle Pipeline Stream */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
        {[
          { state: 'CREATED', color: '#64748B', desc: 'Order Intent' },
          { state: 'PENDING RAIL', color: '#0EA5E9', desc: 'Razorpay Outbound' },
          { state: 'UNCERTAIN', color: '#F59E0B', desc: 'Async Gap / Timeout' },
          { state: 'VERIFYING', color: '#8B5CF6', desc: 'HMAC & Audit Match' },
          { state: 'AUTHORIZED', color: '#3B82F6', desc: 'Payment Hold' },
          { state: 'CAPTURED', color: '#22C55E', desc: 'Settlement Clean' },
          { state: 'RECONCILED', color: '#10B981', desc: 'Ledger Sealed' },
        ].map((s, idx, arr) => (
          <div key={s.state} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: `1px solid ${s.color}40`, textAlign: 'center' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: s.color }}>{s.state}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.desc}</div>
            </div>
            {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>→</span>}
          </div>
        ))}
      </div>

      {/* Branching Exception Terminal Paths & Uncertainty Resolution Loop */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {/* Exception Terminal Paths */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            EXCEPTION TERMINAL PATHS
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#EF4444' }}>FAILED</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Bank decline or signature reject</div>
            </div>
            <div style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#A855F7' }}>MANUAL REVIEW</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Escalated to human operator</div>
            </div>
          </div>
        </div>

        {/* Resolution Decision Logic */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            UNCERTAINTY RESOLUTION PIPELINE
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>UNCERTAINTY DETECTED</span>
            <span>→</span>
            <span style={{ color: '#8B5CF6', fontWeight: 700 }}>AI DETECTIVE</span>
            <span>→</span>
            <span style={{ color: '#3B82F6', fontWeight: 700 }}>POLICY ENGINE</span>
            <span>→</span>
            <span style={{ color: '#22C55E', fontWeight: 700 }}>AUTO RESOLVE / ESCALATE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
