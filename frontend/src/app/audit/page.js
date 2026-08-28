'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText, ShieldCheck, User, RefreshCw } from 'lucide-react';

export default function AuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditTrail(50);
      setEvents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFF' }}>
            Operational Audit Trail
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Immutable audit event log tracking all system and human operator financial actions.
          </p>
        </div>

        <button onClick={loadAudit} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit trail...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit log entries recorded yet. Manual resolutions and system decisions will appear here.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Event Type</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Resource Type</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Resource ID</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.audit_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 20px', color: '#2AB673', fontWeight: 600 }}>
                    {evt.event_type}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#FFF' }}>
                    {evt.actor_id}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                    {evt.resource_type}
                  </td>
                  <td style={{ padding: '14px 20px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {evt.resource_id}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
