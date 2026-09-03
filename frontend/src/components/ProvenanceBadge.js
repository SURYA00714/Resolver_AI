'use client';

import { ShieldCheck, Webhook, Cpu, Sparkles, RotateCcw, AlertTriangle } from 'lucide-react';

export default function ProvenanceBadge({ type, size = 'normal' }) {
  const isCompact = size === 'small';

  const badgeMap = {
    REAL_RAZORPAY: {
      label: 'REAL RAZORPAY API',
      bg: 'var(--badge-real-bg)',
      color: 'var(--badge-real-text)',
      border: 'var(--badge-real-border)',
      icon: <ShieldCheck size={isCompact ? 11 : 13} />,
    },
    REAL_WEBHOOK: {
      label: 'REAL RAZORPAY WEBHOOK',
      bg: 'rgba(6, 182, 212, 0.12)',
      color: '#22D3EE',
      border: 'rgba(6, 182, 212, 0.3)',
      icon: <Webhook size={isCompact ? 11 : 13} />,
    },
    POLICY_ENGINE: {
      label: 'POLICY ENGINE',
      bg: 'var(--badge-policy-bg)',
      color: 'var(--badge-policy-text)',
      border: 'var(--badge-policy-border)',
      icon: <Cpu size={isCompact ? 11 : 13} />,
    },
    AI_DETECTIVE: {
      label: 'AI DETECTIVE',
      bg: 'var(--badge-ai-bg)',
      color: 'var(--badge-ai-text)',
      border: 'var(--badge-ai-border)',
      icon: <Sparkles size={isCompact ? 11 : 13} />,
    },
    INTERNAL_REPLAY: {
      label: 'INTERNAL REPLAY (NOT A RAZORPAY REDELIVERY)',
      bg: 'rgba(245, 158, 11, 0.12)',
      color: '#FBBF24',
      border: 'rgba(245, 158, 11, 0.3)',
      icon: <RotateCcw size={isCompact ? 11 : 13} />,
    },
    LOCAL_SIMULATION: {
      label: '⚠ LOCAL SIMULATION',
      bg: 'var(--badge-sim-bg)',
      color: 'var(--badge-sim-text)',
      border: 'var(--badge-sim-border)',
      icon: <AlertTriangle size={isCompact ? 11 : 13} />,
    },
  };

  const current = badgeMap[type] || {
    label: type || 'SYSTEM',
    bg: 'rgba(100, 116, 139, 0.12)',
    color: '#94A3B8',
    border: 'rgba(100, 116, 139, 0.3)',
    icon: <ShieldCheck size={isCompact ? 11 : 13} />,
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isCompact ? '4px' : '6px',
        padding: isCompact ? '2px 6px' : '4px 10px',
        borderRadius: '6px',
        background: current.bg,
        color: current.color,
        border: `1px solid ${current.border}`,
        fontSize: isCompact ? '0.7rem' : '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {current.icon}
      {current.label}
    </span>
  );
}
