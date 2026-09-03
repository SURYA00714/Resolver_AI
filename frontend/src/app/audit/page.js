'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { FileText, Search, RefreshCw, Lock, ShieldCheck, User } from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditTrail(100);
      setLogs(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch compliance audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (log.event_type && log.event_type.toLowerCase().includes(term)) ||
      (log.actor_id && log.actor_id.toLowerCase().includes(term)) ||
      (log.resource_id && log.resource_id.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <FileText size={22} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Immutable Compliance Audit Trail
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Compliance-oriented append-only audit log tracking operator actions, resolution decisions, and system mutations.
          </p>
        </div>

        <button onClick={loadAuditLogs} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Refresh Trail
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event type, actor, or resource ID..."
            style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              padding: '10px 14px 10px 38px', color: 'var(--text-primary)', fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Event Action</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Actor ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Resource Type & ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Provenance</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading compliance audit trail...' : 'No audit events found.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.audit_id || log.created_at} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {log.event_type}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} color="var(--text-muted)" />
                      {log.actor_id || 'SYSTEM'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>{log.resource_type}</span>
                    {log.resource_id}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <ProvenanceBadge type="POLICY_ENGINE" size="small" />
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
