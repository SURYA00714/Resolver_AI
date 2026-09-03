'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Zap,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (stateFilter) params.status = stateFilter;
      const data = await api.getPayments(params);
      setPayments(data.items || data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch payment intents registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [stateFilter]);

  const handleVerify = async (e, intentId) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(`verify-${intentId}`);
    try {
      const res = await api.verifyWithRazorpay(intentId);
      alert(`Razorpay Verification Snapshot for ${intentId.slice(0, 8)}:\n` + JSON.stringify(res.razorpay_snapshot || res.razorpay_order_payments || res, null, 2));
      await loadPayments();
    } catch (err) {
      alert(`Verification Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReconcile = async (e, intentId) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(`reconcile-${intentId}`);
    try {
      const res = await api.reconcilePayment(intentId);
      alert(`Resolution Result: ${res.status} | Final State: ${res.final_state} | Action: ${res.action}`);
      await loadPayments();
    } catch (err) {
      alert(`Reconciliation Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPayments = payments.filter((item) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (item.payment_intent_id && item.payment_intent_id.toLowerCase().includes(term)) ||
      (item.razorpay_order_id && item.razorpay_order_id.toLowerCase().includes(term)) ||
      (item.merchant_reference && item.merchant_reference.toLowerCase().includes(term)) ||
      (item.active_payment_id && item.active_payment_id.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <CreditCard size={22} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Payment Intents Registry
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Authoritative local database registry tracking Razorpay payment state lifecycle and evidence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={loadPayments} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <Link href="/payments/new" className="btn btn-primary">
            <PlusCircle size={15} />
            Create Order & Pay
          </Link>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Payment Intent ID, Order ID, Ref, or Payment ID..."
            style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              padding: '10px 14px 10px 38px', color: 'var(--text-primary)', fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Payment States</option>
            <option value="CAPTURED">CAPTURED</option>
            <option value="AUTHORIZED">AUTHORIZED</option>
            <option value="UNCERTAIN">UNCERTAIN</option>
            <option value="FAILED">FAILED</option>
            <option value="DUPLICATE_SUSPECTED">DUPLICATE_SUSPECTED</option>
            <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
            <option value="RECONCILED">RECONCILED</option>
            <option value="CREATED">CREATED</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Payments Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Payment Intent ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status State</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Razorpay Identifiers</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Amount</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Provenance</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Last Updated</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Fetching payment intents from registry...' : 'No payment intents found matching filters.'}
                </td>
              </tr>
            ) : (
              filteredPayments.map((item) => (
                <tr key={item.payment_intent_id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <Link href={`/payments/${item.payment_intent_id}`} style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      {item.payment_intent_id?.slice(0, 16)}…
                    </Link>
                    {item.merchant_reference && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {item.merchant_reference}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <StatusBadge status={item.current_state} />
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>Order: {item.razorpay_order_id || 'N/A'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pay: {item.active_payment_id || 'N/A'}</div>
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.currency} {parseFloat(item.amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <ProvenanceBadge type={item.active_rail === 'RAZORPAY' ? 'REAL_RAZORPAY' : 'LOCAL_SIMULATION'} size="small" />
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => handleVerify(e, item.payment_intent_id)}
                        disabled={actionLoading === `verify-${item.payment_intent_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title="Verify with Razorpay REST API"
                      >
                        <ShieldCheck size={13} />
                        Verify
                      </button>
                      <button
                        onClick={(e) => handleReconcile(e, item.payment_intent_id)}
                        disabled={actionLoading === `reconcile-${item.payment_intent_id}`}
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title="Run Autonomous Resolution Engine"
                      >
                        <Zap size={13} />
                        Reconcile
                      </button>
                      <Link
                        href={`/payments/${item.payment_intent_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', textDecoration: 'none' }}
                      >
                        <ExternalLink size={13} />
                        Inspect
                      </Link>
                    </div>
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
