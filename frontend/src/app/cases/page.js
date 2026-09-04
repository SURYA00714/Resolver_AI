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
  Filter,
  Check,
} from 'lucide-react';
import Link from 'next/link';

export default function ReconciliationCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
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
      alert(`Replay Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualResolveSubmit = async (e) => {
    e.preventDefault();
    if (!manualResolveModal) return;
    try {
      await api.resolveCase(manualResolveModal.case_id, {
        resolution_action: 'MANUAL_OVERRIDE',
        notes: resolutionNote,
      });
      alert('Case resolved successfully with immutable audit entry.');
      setManualResolveModal(null);
      setResolutionNote('');
      await loadCases();
    } catch (err) {
      alert(`Resolution Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Header Banner */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
          }}>
            <AlertTriangle size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Reconciliation Cases Workspace
              </h1>
              <span style={{
                background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning)',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              }}>
                THREE TRUTHS MATRIX
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
              Operational queue for state machine discrepancies, rail timeouts, duplicate webhooks, and manual resolution escalations
            </p>
          </div>
        </div>

        <button
          onClick={loadCases}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', fontWeight: 700 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Cases
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{
        padding: '12px 18px', display: 'flex', gap: '16px', alignItems: 'center',
      }}>
        <Filter size={16} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Filter Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: 'var(--bg-input)', border: '1px solid var(--border-color)',
            borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.83rem',
            outline: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          <option value="">All Case Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* Cases Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Case ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Payment Intent ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Anomaly Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Created At</th>
              <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
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
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    {c.case_id?.slice(0, 12)}…
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                    <Link href={`/payments/${c.payment_intent_id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 700 }}>
                      {c.payment_intent_id?.slice(0, 16)}…
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800,
                      background: c.status === 'RESOLVED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                      color: c.status === 'RESOLVED' ? 'var(--color-success)' : 'var(--color-warning)',
                      border: `1px solid ${c.status === 'RESOLVED' ? 'var(--color-success-border)' : 'var(--color-warning-border)'}`,
                    }}>
                      {c.status || 'OPEN'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {c.anomaly_type || c.issue_type || 'PAYMENT_STATE_ANOMALY'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleForensicReplay(c.payment_intent_id)}
                        disabled={actionLoading === `replay-${c.payment_intent_id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Run Read-Only Forensic Simulation"
                      >
                        <RotateCcw size={12} className={actionLoading === `replay-${c.payment_intent_id}` ? 'spin' : ''} /> Forensic Replay
                      </button>
                      <button
                        onClick={() => setManualResolveModal(c)}
                        disabled={c.status === 'RESOLVED'}
                        className={`btn btn-sm ${c.status === 'RESOLVED' ? 'btn-ghost' : 'btn-primary'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle2 size={12} /> Manual Resolve
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }}>
          <form onSubmit={handleManualResolveSubmit} className="card" style={{
            padding: '24px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Manual Resolution — Case {manualResolveModal.case_id?.slice(0, 10)}
            </h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
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
                padding: '12px', color: 'var(--text-primary)', fontSize: '0.85rem',
                marginBottom: '20px', outline: 'none', fontWeight: 500,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setManualResolveModal(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
              >
                Submit Resolution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
