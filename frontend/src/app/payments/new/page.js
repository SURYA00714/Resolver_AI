'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PlusCircle, AlertTriangle, CheckCircle2, ExternalLink, Copy } from 'lucide-react';
import Link from 'next/link';

export default function CreateOrderPage() {
  const [form, setForm] = useState({ amount: '', currency: 'INR', receipt: '', notes_key: '', notes_value: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError('Amount must be a positive number in INR.'); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    const body = {
      amount,
      currency: form.currency,
      receipt: form.receipt || undefined,
      notes: (form.notes_key && form.notes_value) ? { [form.notes_key]: form.notes_value } : undefined,
    };

    try {
      const res = await api.createOrder(body);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to create order. Check that Razorpay credentials are configured.');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <PlusCircle size={22} color="#2AB673" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
            Create Razorpay Order
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
          Creates a real order via <code>POST /v1/orders</code> on Razorpay. 
          Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to be set in the backend environment.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '14px 20px', marginBottom: '24px', borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#F87171',
        }}>
          <AlertTriangle size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{error}</div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px' }}>
              To configure credentials, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your <code>.env</code> file.
            </div>
          </div>
        </div>
      )}

      {result ? (
        <div style={{
          padding: '24px', borderRadius: '12px',
          background: 'rgba(42, 182, 115, 0.06)', border: '1px solid rgba(42, 182, 115, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <CheckCircle2 size={20} color="#2AB673" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2AB673', margin: 0 }}>
              Order Created Successfully
            </h2>
          </div>

          {[
            { label: 'Payment Intent ID (local)', value: result.payment_intent_id, key: 'intent' },
            { label: 'Razorpay Order ID', value: result.razorpay_order_id, key: 'order' },
            { label: 'Amount', value: `₹${result.amount} ${result.currency}`, key: null },
            { label: 'Razorpay Status', value: result.razorpay_status, key: null },
            { label: 'Mode', value: result.razorpay_mode, key: null },
          ].map(({ label, value, key }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(42, 182, 115, 0.1)' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>{value}</code>
                {key && (
                  <button onClick={() => copy(value, key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === key ? '#2AB673' : '#475569' }}>
                    <Copy size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <Link href={`/payments/${result.payment_intent_id}`} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ExternalLink size={14} />
              View Payment Intent
            </Link>
            <button onClick={() => { setResult(null); setForm({ amount: '', currency: 'INR', receipt: '', notes_key: '', notes_value: '' }); }} className="btn btn-secondary">
              Create Another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Amount (INR) *
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '0.9rem' }}>₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="499.00"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px',
                  padding: '12px 14px 12px 32px', color: '#E2E8F0', fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
              Enter in rupees. The API will convert to paise automatically.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Currency
            </label>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              style={{
                width: '100%', background: '#0A0F1A', border: '1px solid #1E2535',
                borderRadius: '8px', padding: '12px 14px', color: '#E2E8F0', fontSize: '0.875rem',
              }}
            >
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Receipt / Reference Number
            </label>
            <input
              type="text"
              value={form.receipt}
              onChange={e => setForm(f => ({ ...f, receipt: e.target.value }))}
              placeholder="receipt_2024_001 (optional)"
              maxLength={100}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px',
                padding: '12px 14px', color: '#E2E8F0', fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Notes (optional key-value)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="text"
                value={form.notes_key}
                onChange={e => setForm(f => ({ ...f, notes_key: e.target.value }))}
                placeholder="Key (e.g. product_id)"
                style={{ background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px', padding: '10px 14px', color: '#E2E8F0', fontSize: '0.875rem' }}
              />
              <input
                type="text"
                value={form.notes_value}
                onChange={e => setForm(f => ({ ...f, notes_value: e.target.value }))}
                placeholder="Value (e.g. prod_xyz)"
                style={{ background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px', padding: '10px 14px', color: '#E2E8F0', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1E2535', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Link href="/payments" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <PlusCircle size={15} />
              {loading ? 'Creating Order on Razorpay...' : 'Create Real Razorpay Order'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
