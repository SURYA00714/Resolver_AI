'use client';

import { Cpu, ShieldCheck, FileCode, CheckCircle, UserCheck } from 'lucide-react';

export default function AiPipelineVisualizer() {
  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            AI Advisory vs Policy Enforcement Architecture
          </h2>
        </div>
        <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', fontWeight: 700 }}>
          AI = ADVISORY | POLICY = ENFORCEMENT | LEDGER = TRUTH
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'center' }}>
        {[
          { title: 'EVENT INGEST', role: 'HMAC Webhook', badge: 'INPUT', color: '#64748B' },
          { title: 'AI DETECTIVE', role: 'Pattern Analysis', badge: 'ADVISORY', color: '#8B5CF6' },
          { title: 'HYPOTHESIS', role: 'Root Cause Hypothesis', badge: 'ADVISORY', color: '#A855F7' },
          { title: 'POLICY ENGINE', role: 'Rule Validation', badge: 'ENFORCEMENT', color: '#3B82F6' },
          { title: 'DECISION', role: 'State Transition', badge: 'LEDGER', color: '#22C55E' },
          { title: 'MANUAL OVERRIDE', role: 'Operator Review', badge: 'HUMAN', color: '#F59E0B' },
        ].map((node, i, arr) => (
          <div key={i} style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: `1px solid ${node.color}40`, textAlign: 'center' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: node.color, padding: '2px 6px', borderRadius: '4px', background: `${node.color}15` }}>
              {node.badge}
            </span>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>{node.title}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{node.role}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
