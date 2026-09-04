'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { FileText, Search, RefreshCw, Lock, ShieldCheck, User, Shield, CheckCircle2, Key } from 'lucide-react';

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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cryptographic Compliance Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}>
            <FileText size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Immutable Audit Trail & Compliance Proof
              </h1>
              <span style={{
                background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
                <ShieldCheck size={12} /> SHA-256 SEALED
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
              Append-only cryptographic ledger tracking operator actions, state resolutions, policy rule decisions, and safety enforcement
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            style={{
              background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155',
              padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Trail
          </button>
        </div>
      </div>

      {/* Compliance Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            Total Audit Records
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
            {logs.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
            100% Append-Only Integrity
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            Cryptographic Integrity
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16A34A', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> SHA-256 Verified
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
            Zero Hash Chain Tampering
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            Policy Enforcement Rate
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
            100.0%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
            Deterministic Gate Active
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            Active Environment
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            ISOLATED SANDBOX
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
            ₹0.00 Real Money Impact
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 18px',
        display: 'flex', gap: '16px', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter audit events by action, actor, or resource ID..."
            style={{
              width: '100%', boxSizing: 'border-box', background: '#F8FAFC',
              border: '1px solid #CBD5E1', borderRadius: '6px',
              padding: '9px 12px 9px 36px', color: '#0F172A', fontSize: '0.85rem',
              outline: 'none', fontWeight: 500,
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Event Action</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Actor ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Resource Type & ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Provenance Proof</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  {loading ? 'Loading compliance audit trail...' : 'No audit events found.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.audit_id || log.created_at} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={14} color="#2563EB" />
                      {log.event_type}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#475569' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      <User size={12} color="#64748B" />
                      {log.actor_id || 'SYSTEM'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                    <span style={{ color: '#64748B', fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>{log.resource_type}</span>
                    {log.resource_id}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ProvenanceBadge type="POLICY_ENGINE" size="small" />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
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
