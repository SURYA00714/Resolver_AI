'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { AlertTriangle, CheckCircle2, UserCheck, ShieldAlert, X } from 'lucide-react';
import Link from 'next/link';

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [operatorId, setOperatorId] = useState('OP_ENGINEER_01');
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('CAPTURE');
  const [submitting, setSubmitting] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    try {
      const data = await api.getCases(statusFilter === 'ALL' ? '' : statusFilter);
      setCases(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [statusFilter]);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSubmitting(true);
    try {
      await api.resolveCase(selectedCase.case_id, {
        operator_id: operatorId,
        resolution_notes: notes,
        action: action,
      });
      setSelectedCase(null);
      setNotes('');
      await loadCases();
    } catch (err) {
      alert(`Manual resolution failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFF' }}>
            Operational Reconciliation Cases
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Ambiguous payment intents escalated for human operator review and manual decisioning.
          </p>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {['OPEN', 'RESOLVED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: statusFilter === st ? '#2AB673' : 'transparent',
                color: statusFilter === st ? '#FFF' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading operational cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No reconciliation cases found for status: {statusFilter}
          </div>
        ) : (
          cases.map((c) => (
            <div key={c.case_id} className="glass-card" style={{ padding: '20px', borderLeft: `4px solid ${c.status === 'OPEN' ? '#EF4444' : '#22C55E'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldAlert size={18} color={c.status === 'OPEN' ? '#EF4444' : '#22C55E'} />
                    <strong style={{ fontSize: '1rem', color: '#FFF' }}>{c.case_type}</strong>
                    <StatusBadge status={c.status} />
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', fontWeight: 600 }}>
                      {c.severity} SEVERITY
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                    Case ID: {c.case_id} | Intent ID: {c.payment_intent_id}
                  </div>
                </div>

                {c.status === 'OPEN' && (
                  <button
                    onClick={() => setSelectedCase(c)}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    <UserCheck size={14} /> Resolve Case
                  </button>
                )}
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '12px', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '6px' }}>
                Reason: {c.reason}
              </p>

              {c.status === 'RESOLVED' && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
                  <div>Operator: <strong style={{ color: '#FFF' }}>{c.operator_id}</strong></div>
                  <div>Notes: <strong style={{ color: '#FFF' }}>{c.resolution_notes}</strong></div>
                  <div>Resolved At: <strong style={{ color: '#FFF' }}>{new Date(c.resolved_at).toLocaleString()}</strong></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Manual Resolution Modal */}
      {selectedCase && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="glass-card" style={{ width: '500px', padding: '28px', position: 'relative' }}>
            <button
              onClick={() => setSelectedCase(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFF', marginBottom: '8px' }}>
              Manual Operator Resolution
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Override ambiguity for Intent <code style={{ color: '#2AB673' }}>{selectedCase.payment_intent_id.slice(0, 8)}...</code>
            </p>

            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Operator ID
                </label>
                <input
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#FFF',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Action to Apply
                </label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#FFF',
                    fontSize: '0.88rem',
                  }}
                >
                  <option value="CAPTURE">CAPTURE — Force capture authorized funds</option>
                  <option value="REFUND">REFUND — Issue refund to customer</option>
                  <option value="VOID">VOID — Cancel authorization</option>
                  <option value="CLOSE">CLOSE — Mark case closed without financial mutation</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Resolution Audit Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain why this resolution action was selected..."
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#FFF',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Confirm Resolution & Log Audit Event'}
                </button>
                <button type="button" onClick={() => setSelectedCase(null)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
