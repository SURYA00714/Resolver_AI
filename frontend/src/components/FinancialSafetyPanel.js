'use client';

import { ShieldCheck, Lock, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function FinancialSafetyPanel({ data }) {
  const safety = data?.financial_safety || {};
  const aiTestMoney = safety.ai_test_money_moved ?? 0;
  const chaosMoney = safety.chaos_money_moved ?? 0;
  const blockedTransitions = safety.unsafe_transitions_blocked ?? 0;
  const duplicatesPrevented = safety.duplicate_processing_prevented ?? 0;
  const invalidSignatures = safety.invalid_signatures_rejected ?? 0;
  const manualEscalations = safety.manual_review_escalations ?? 0;

  return (
    <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '8px' }}>
            <ShieldCheck size={20} color="#22C55E" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Financial Safety & Isolation Invariants
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
              Deterministic state guards enforce zero un-policy-backed financial mutations.
            </p>
          </div>
        </div>
        <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', fontWeight: 700 }}>
          100% PROTECTED
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Real Money Moved by Test Lab */}
        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={12} color="#10B981" />
            AI TEST LAB MONEY MOVED
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
            ₹{aiTestMoney.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Synthetic ID Sandbox Guard
          </div>
        </div>

        {/* Real Money Moved by Chaos Lab */}
        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={12} color="#10B981" />
            CHAOS LAB MONEY MOVED
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
            ₹{chaosMoney.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Zero Production Egress
          </div>
        </div>

        {/* Unsafe Transitions Blocked */}
        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={12} color="#3B82F6" />
            UNSAFE TRANSITIONS BLOCKED
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3B82F6', marginTop: '4px' }}>
            {blockedTransitions}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            State Machine Constraint Guard
          </div>
        </div>

        {/* Invalid Signatures Rejected */}
        <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertOctagon size={12} color="#EF4444" />
            FORGED SIGNATURES BLOCKED
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#EF4444', marginTop: '4px' }}>
            {invalidSignatures}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            HMAC SHA-256 Gatekeeper
          </div>
        </div>
      </div>
    </div>
  );
}
