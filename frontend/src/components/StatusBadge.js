'use client';

const stateConfig = {
  CAPTURED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.3)' },
  AUTHORIZED: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  UNCERTAIN: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
  VERIFYING: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4', border: 'rgba(6, 182, 212, 0.3)' },
  PENDING_RAIL: { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.25)' },
  FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  DUPLICATE_SUSPECTED: { bg: 'rgba(236, 72, 153, 0.15)', text: '#EC4899', border: 'rgba(236, 72, 153, 0.3)' },
  MANUAL_REVIEW: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.3)' },
  RECONCILED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.3)' },
  CREATED: { bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8', border: 'rgba(100, 116, 139, 0.3)' },
  ACTION_EXECUTING: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
  ACTION_CONFIRMED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.3)' },

  // Cases statuses
  OPEN: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' },
  RESOLVED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.3)' },
  IN_PROGRESS: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.3)' },
};

export default function StatusBadge({ status }) {
  const normalized = (status || 'CREATED').toUpperCase();
  const config = stateConfig[normalized] || {
    bg: 'rgba(100, 116, 139, 0.15)',
    text: '#94A3B8',
    border: 'rgba(100, 116, 139, 0.3)',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: config.text,
        }}
      />
      {normalized}
    </span>
  );
}
