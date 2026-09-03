'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function ReconciliationCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [manualResolveModal, setManualResolveModal] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases(statusFilter);
      setCases(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Failed to load reconciliation cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [statusFilter]);

  const handleForensicReplay = async (paymentIntentId) => {
    setActionLoading(`replay-${paymentIntentId}`);
    try {
      const res = await api.forensicReplayCase(paymentIntentId);
      alert(`READ-ONLY FORENSIC REPLAY RESULT (ZERO SIDE EFFECTS):\n\n` + JSON.stringify(res, null, 2));
    } catch (err) {
      alert(`Forensic Replay Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualResolveSubmit = async (e) => {
    e.preventDefault();
    if (!manualResolveModal) return;
    setActionLoading(`resolve-${manualResolveModal.case_id}`);
    try {
      await api.resolveCase(manualResolveModal.case_id, {
        resolution_reason: resolutionNote || 'Operator manual reconciliation',
        action: 'MANUAL_RESOLVE',
      });
      alert('Case manually resolved successfully.');
      setManualResolveModal(null);
      setResolutionNote('');
      await loadCases();
    } catch (err) {
      alert(`Manual Resolution Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <AlertTriangle size={22} color="#F59E0B" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Reconciliation Cases Workspace
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Operational queue for payment state anomalies, duplicate captures, and manual review escalations.
          </p>
        </div>

        <button onClick={loadCases} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Refresh Cases
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-input)', border: '1px solid var(--border-color)',
            borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">All Case Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Cases Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Case ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Payment Intent ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Anomaly Type</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Created At</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading reconciliation cases...' : 'No open cases found.'}
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.case_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {c.case_id?.slice(0, 12)}…
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <Link href={`/payments/${c.payment_intent_id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 700 }}>
                      {c.payment_intent_id?.slice(0, 16)}…
                    </Link>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                      background: c.status === 'RESOLVED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: c.status === 'RESOLVED' ? '#22C55E' : '#F59E0B',
                    }}>
                      {c.status || 'OPEN'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.anomaly_type || c.issue_type || 'PAYMENT_STATE_ANOMALY'}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleForensicReplay(c.payment_intent_id)}
                        disabled={actionLoading === `replay-${c.payment_intent_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title="Run Read-Only Forensic Simulation"
                      >
                        <RotateCcw size={13} />
                        Forensic Replay
                      </button>
                      <button
                        onClick={() => setManualResolveModal(c)}
                        disabled={c.status === 'RESOLVED'}
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        <CheckCircle2 size={13} />
                        Manual Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Resolution Modal */}
      {manualResolveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleManualResolveSubmit} className="glass-card" style={{ padding: '28px', width: '480px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Manual Resolution — Case {manualResolveModal.case_id?.slice(0, 10)}
            </h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Record operator resolution justification in the compliance audit log.
            </p>
            <textarea
              required
              rows={4}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Specify manual resolution reason (e.g. Verified with bank switch, user confirmed refund)..."
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
                border: '1px solid var(--border-color)', borderRadius: '8px',
                padding: '12px', color: 'var(--text-primary)', fontSize: '0.875rem',
                marginBottom: '20px', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setManualResolveModal(null)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Submit Manual Resolution</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
