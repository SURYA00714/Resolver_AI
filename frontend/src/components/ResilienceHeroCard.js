'use client';

import { ShieldCheck, Activity, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

export default function ResilienceHeroCard({ data }) {
  const res = data?.resilience_score || {};
  const overall = res.overall ?? 100;
  const stateIntegrity = res.state_integrity !== undefined ? `${res.state_integrity}%` : 'N/A';
  const webhookReliability = res.webhook_reliability !== undefined ? `${res.webhook_reliability}%` : 'N/A';
  const idempotency = res.idempotency !== undefined ? `${res.idempotency}%` : 'N/A';
  const failureHandling = res.failure_handling !== undefined ? `${res.failure_handling}%` : 'N/A';
  const security = res.security !== undefined ? `${res.security}%` : 'N/A';
  const auditability = res.auditability !== undefined ? `${res.auditability}%` : 'N/A';

  const scoreColor = overall >= 90 ? '#22C55E' : overall >= 75 ? '#3B82F6' : '#F59E0B';

  return (
    <div className="glass-card" style={{ padding: '24px', border: `1px solid ${scoreColor}40`, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color={scoreColor} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            SYSTEM RESILIENCE
          </h2>
        </div>
        <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: '4px', background: `${scoreColor}15`, color: scoreColor, fontWeight: 800 }}>
          LIVE VERIFIED SCORE
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '3.2rem', fontWeight: 900, color: scoreColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {overall}
        </span>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>/ 100</span>
      </div>

      {/* 6 Dimension Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {[
          { label: 'State Integrity', val: stateIntegrity },
          { label: 'Webhook Reliability', val: webhookReliability },
          { label: 'Idempotency', val: idempotency },
          { label: 'Failure Handling', val: failureHandling },
          { label: 'Security', val: security },
          { label: 'Auditability', val: auditability },
        ].map((dim) => (
          <div key={dim.label} style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{dim.label}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: dim.val === 'N/A' ? 'var(--text-muted)' : scoreColor }}>{dim.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
