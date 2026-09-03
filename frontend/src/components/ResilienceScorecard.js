'use client';

import { Zap, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ResilienceScorecard({ data }) {
  const scorecard = data?.chaos_scorecard || [];

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="#F59E0B" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Chaos & Adversarial Resilience Scorecard
          </h2>
        </div>
        <Link href="/engineering/testing" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
          Chaos Lab <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {scorecard.map((sc) => {
          const isPass = sc.status === 'PASS';
          const isFail = sc.status === 'FAIL';
          const isNotTested = sc.status === 'NOT TESTED';

          const badgeBg = isPass ? 'rgba(34, 197, 94, 0.12)' : isFail ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.12)';
          const badgeColor = isPass ? '#22C55E' : isFail ? '#EF4444' : '#94A3B8';
          const Icon = isPass ? CheckCircle2 : isFail ? AlertTriangle : HelpCircle;

          return (
            <div key={sc.scenario_type} style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {sc.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {sc.last_run_at ? new Date(sc.last_run_at).toLocaleTimeString() : 'Never Executed'}
                </div>
              </div>
              <span style={{
                fontSize: '0.68rem', padding: '3px 8px', borderRadius: '4px',
                background: badgeBg, color: badgeColor, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0
              }}>
                <Icon size={12} />
                {sc.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
