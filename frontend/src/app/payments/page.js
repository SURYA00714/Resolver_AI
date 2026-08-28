'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { CreditCard, Filter, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [reconcilingId, setReconcilingId] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await api.getPayments({ status: statusFilter, limit: 50 });
      setPayments(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [statusFilter]);

  const handleReconcile = async (id, e) => {
    e.stopPropagation();
    setReconcilingId(id);
    try {
      await api.reconcilePayment(id);
      await loadPayments();
    } catch (err) {
      alert(`Reconciliation error: ${err.message}`);
    } finally {
      setReconcilingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFF' }}>
            Payment Intents Registry
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Authoritative operational truth tracking {total} merchant payment intents.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status Filter */}
          <div style={{ position: 'relative' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">All States (15 States)</option>
              <option value="UNCERTAIN">UNCERTAIN</option>
              <option value="DUPLICATE_SUSPECTED">DUPLICATE_SUSPECTED</option>
              <option value="AUTHORIZED">AUTHORIZED</option>
              <option value="CAPTURED">CAPTURED</option>
              <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
              <option value="RECONCILED">RECONCILED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <button onClick={loadPayments} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading payment intents...
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            No payment intents match the filter state.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Payment Intent ID</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Order ID</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Current State</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Rail</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Updated</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.payment_intent_id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.location.href = `/payments/${p.payment_intent_id}`}
                >
                  <td style={{ padding: '14px 20px', fontFamily: 'JetBrains Mono, monospace', color: '#FFF', fontWeight: 600 }}>
                    {p.payment_intent_id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                    {p.order_id || '—'}
                  </td>
                  <td style={{ padding: '14px 20px', color: '#FFF', fontWeight: 700 }}>
                    {p.currency} {parseFloat(p.amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <StatusBadge status={p.current_state} />
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {p.active_rail || 'RAZORPAY_TEST'}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {new Date(p.updated_at).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {['UNCERTAIN', 'DUPLICATE_SUSPECTED', 'PENDING_RAIL', 'AUTHORIZED'].includes(p.current_state) && (
                        <button
                          onClick={(e) => handleReconcile(p.payment_intent_id, e)}
                          disabled={reconcilingId === p.payment_intent_id}
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {reconcilingId === p.payment_intent_id ? 'Resolving...' : 'Reconcile'}
                        </button>
                      )}
                      <Link
                        href={`/payments/${p.payment_intent_id}`}
                        style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                      >
                        <ArrowRight size={16} />
                      </Link>
                    </div>
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
