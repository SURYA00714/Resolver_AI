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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap', gap: '16px',
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
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Reconciliation Cases Workspace
              </h1>
              <span style={{
                background: '#FEF3C7', border: '1px solid #FDE047', color: '#B45309',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              }}>
                THREE TRUTHS MATRIX
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
              Operational queue for state machine discrepancies, rail timeouts, duplicate webhooks, and manual resolution escalations
            </p>
          </div>
        </div>

        <button
          onClick={loadCases}
          disabled={loading}
          style={{
            background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155',
            padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Cases
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 18px',
        display: 'flex', gap: '16px', alignItems: 'center',
      }}>
        <Filter size={16} color="#64748B" />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Filter Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            background: '#F8FAFC', border: '1px solid #CBD5E1',
            borderRadius: '6px', padding: '8px 12px', color: '#0F172A', fontSize: '0.83rem',
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
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* Cases Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  {loading ? 'Loading reconciliation cases...' : 'No open cases found.'}
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.case_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                    {c.case_id?.slice(0, 12)}…
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#2563EB' }}>
                    <Link href={`/payments/${c.payment_intent_id}`} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700 }}>
                      {c.payment_intent_id?.slice(0, 16)}…
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800,
                      background: c.status === 'RESOLVED' ? '#DCFCE7' : '#FEF3C7',
                      color: c.status === 'RESOLVED' ? '#15803D' : '#B45309',
                      border: `1px solid ${c.status === 'RESOLVED' ? '#86EFAC' : '#FDE047'}`,
                    }}>
                      {c.status || 'OPEN'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0F172A' }}>
                    {c.anomaly_type || c.issue_type || 'PAYMENT_STATE_ANOMALY'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleForensicReplay(c.payment_intent_id)}
                        disabled={actionLoading === `replay-${c.payment_intent_id}`}
                        style={{
                          background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155',
                          padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}
                        title="Run Read-Only Forensic Simulation"
                      >
                        <RotateCcw size={12} /> Forensic Replay
                      </button>
                      <button
                        onClick={() => setManualResolveModal(c)}
                        disabled={c.status === 'RESOLVED'}
                        style={{
                          background: c.status === 'RESOLVED' ? '#F1F5F9' : '#2563EB',
                          border: 'none', color: c.status === 'RESOLVED' ? '#94A3B8' : '#FFFFFF',
                          padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          cursor: c.status === 'RESOLVED' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}
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
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }}>
          <form onSubmit={handleManualResolveSubmit} style={{
            background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px',
            padding: '24px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
              Manual Resolution — Case {manualResolveModal.case_id?.slice(0, 10)}
            </h3>
            <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '16px', lineHeight: '1.5' }}>
              Record operator resolution justification in the compliance audit log.
            </p>
            <textarea
              required
              rows={4}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Specify manual resolution reason (e.g. Verified with bank switch, user confirmed refund)..."
              style={{
                width: '100%', boxSizing: 'border-box', background: '#F8FAFC',
                border: '1px solid #CBD5E1', borderRadius: '8px',
                padding: '12px', color: '#0F172A', fontSize: '0.85rem',
                marginBottom: '20px', outline: 'none', fontWeight: 500,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setManualResolveModal(null)}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '8px 16px', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: '#2563EB', border: 'none', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 800, cursor: 'pointer' }}
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
