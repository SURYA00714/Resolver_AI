'use client';

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = '#2AB673' }) {
  return (
    <div className="glass-card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: color,
          opacity: 0.06,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: `${color}15`,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} color={color} />
          </div>
        )}
      </div>

      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', marginBottom: '4px' }}>
        {value}
      </div>

      {subtitle && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {trend && (
            <span style={{ color: trend.startsWith('+') ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
              {trend}
            </span>
          )}
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
