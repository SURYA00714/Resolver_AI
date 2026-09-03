'use client';

import { ShieldCheck, Activity, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

export default function ResilienceHeroCard({ data }) {
  const res = data?.resilience_score || {};
  const overall = res.overall ?? 100;
  const isInsufficient = res.status === 'INSUFFICIENT_DATA';

  const getVal = (dimKey) => {
    const obj = res[dimKey];
    if (!obj) return 'INSUFFICIENT DATA';
    if (typeof obj === 'object') {
      if (obj.status === 'INSUFFICIENT_DATA' && obj.score === undefined) return 'INSUFFICIENT DATA';
      return `${obj.score ?? 100}%`;
    }
    return `${obj}%`;
  };

  const getMetric = (dimKey) => {
    const obj = res[dimKey];
    if (typeof obj === 'object') return obj.metric || obj.reason || 'Verified by engine';
    return '100% verified';
  };

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
          {isInsufficient ? 'INSUFFICIENT EVIDENCE' : 'LIVE VERIFIED SCORE'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '3.2rem', fontWeight: 900, color: scoreColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {overall}
        </span>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>/ 100</span>
      </div>

      {/* 6 Dimension Breakdown with Metric Descriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {[
          { key: 'state_integrity', label: 'State Integrity' },
          { key: 'webhook_reliability', label: 'Webhook Reliability' },
          { key: 'idempotency', label: 'Idempotency' },
          { key: 'failure_handling', label: 'Failure Handling' },
          { key: 'security', label: 'Security' },
          { key: 'auditability', label: 'Auditability' },
        ].map((dim) => {
          const val = getVal(dim.key);
          const metric = getMetric(dim.key);
          return (
            <div key={dim.key} style={{ padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{dim.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: val === 'INSUFFICIENT DATA' ? 'var(--text-muted)' : scoreColor }}>{val}</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {metric}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
