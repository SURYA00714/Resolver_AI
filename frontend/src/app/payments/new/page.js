'use client';

import { useState } from 'react';
import Script from 'next/script';
import { api } from '@/lib/api';
import { PlusCircle, AlertTriangle, CheckCircle2, ExternalLink, Copy, RefreshCw, CreditCard, Lock } from 'lucide-react';
import Link from 'next/link';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CreateOrderPage() {
  const [form, setForm] = useState({ amount: '', currency: 'INR', receipt: '', notes_key: '', notes_value: '' });
  const [uiState, setUiState] = useState('IDLE'); // IDLE | CREATING_ORDER | OPENING_CHECKOUT | VERIFYING_SIGNATURE | PAYMENT_SUCCESSFUL | PAYMENT_FAILED | SIGNATURE_FAILED
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      setError('Amount must be a positive number in INR.');
      return;
    }

    setUiState('CREATING_ORDER');
    setError(null);
    setResult(null);

    const body = {
      amount,
      currency: form.currency,
      receipt: form.receipt || undefined,
      notes: (form.notes_key && form.notes_value) ? { [form.notes_key]: form.notes_value } : undefined,
    };

    let orderRes;
    try {
      orderRes = await api.createOrder(body);
    } catch (err) {
      setError(err.message || 'Failed to create Razorpay order.');
      setUiState('IDLE');
      return;
    }

    setUiState('OPENING_CHECKOUT');
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError('Failed to load Razorpay Checkout SDK script. Please check connection.');
      setUiState('PAYMENT_FAILED');
      return;
    }

    const key = orderRes.razorpay_key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_resolverai';
    const amountInPaise = Math.round(amount * 100);

    const options = {
      key: key,
      amount: amountInPaise,
      currency: form.currency || 'INR',
      name: 'ResolverAI Merchant',
      description: `Payment for Order ${orderRes.razorpay_order_id}`,
      order_id: orderRes.razorpay_order_id,
      handler: async function (response) {
        setUiState('VERIFYING_SIGNATURE');
        try {
          const verifyRes = await api.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          setResult({
            payment_intent_id: orderRes.payment_intent_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            status: verifyRes.status || 'VERIFIED',
            amount: orderRes.amount,
            currency: orderRes.currency,
          });
          setUiState('PAYMENT_SUCCESSFUL');
        } catch (err) {
          setError(err.message || 'Razorpay checkout signature verification failed.');
          setUiState('SIGNATURE_FAILED');
        }
      },
      modal: {
        ondismiss: function () {
          setUiState((current) => {
            if (current !== 'PAYMENT_SUCCESSFUL' && current !== 'VERIFYING_SIGNATURE') {
              setError('Payment checkout modal was closed before completing payment.');
              return 'PAYMENT_FAILED';
            }
            return current;
          });
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        const failureReason = resp.error?.description || 'Razorpay payment attempt failed.';
        setError(failureReason);
        setUiState('PAYMENT_FAILED');
      });
      rzp.open();
    } catch (err) {
      setError(`Failed to open Razorpay Checkout: ${err.message}`);
      setUiState('PAYMENT_FAILED');
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetForm = () => {
    setResult(null);
    setError(null);
    setUiState('IDLE');
    setForm({ amount: '', currency: 'INR', receipt: '', notes_key: '', notes_value: '' });
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <CreditCard size={22} color="#2AB673" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
            Create & Pay Razorpay Order
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
          Creates a real order via <code>POST /orders</code> and opens Razorpay Checkout modal for real-time payment & signature verification.
        </p>
      </div>

      {/* State Progress Banner */}
      {uiState !== 'IDLE' && uiState !== 'PAYMENT_SUCCESSFUL' && (
        <div style={{
          padding: '14px 20px', marginBottom: '24px', borderRadius: '10px',
          background: uiState === 'PAYMENT_FAILED' || uiState === 'SIGNATURE_FAILED' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
          border: `1px solid ${uiState === 'PAYMENT_FAILED' || uiState === 'SIGNATURE_FAILED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
          display: 'flex', alignItems: 'center', gap: '12px',
          color: uiState === 'PAYMENT_FAILED' || uiState === 'SIGNATURE_FAILED' ? '#F87171' : '#60A5FA',
        }}>
          {uiState === 'CREATING_ORDER' && <RefreshCw size={18} className="spin" />}
          {uiState === 'OPENING_CHECKOUT' && <CreditCard size={18} className="pulse-active" />}
          {uiState === 'VERIFYING_SIGNATURE' && <Lock size={18} className="spin" />}
          {(uiState === 'PAYMENT_FAILED' || uiState === 'SIGNATURE_FAILED') && <AlertTriangle size={18} />}

          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {uiState === 'CREATING_ORDER' && 'Creating Razorpay Order...'}
              {uiState === 'OPENING_CHECKOUT' && 'Opening Razorpay Checkout Modal...'}
              {uiState === 'VERIFYING_SIGNATURE' && 'Verifying HMAC Signature (POST /orders/verify_payment)...'}
              {uiState === 'PAYMENT_FAILED' && 'Payment Failed'}
              {uiState === 'SIGNATURE_FAILED' && 'Signature Verification Failed'}
            </div>
            {error && <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px' }}>{error}</div>}
          </div>
        </div>
      )}

      {/* Success View */}
      {uiState === 'PAYMENT_SUCCESSFUL' && result ? (
        <div style={{
          padding: '24px', borderRadius: '12px',
          background: 'rgba(42, 182, 115, 0.06)', border: '1px solid rgba(42, 182, 115, 0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <CheckCircle2 size={20} color="#2AB673" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2AB673', margin: 0 }}>
              Payment Successful & Signature Verified!
            </h2>
          </div>

          {[
            { label: 'Payment Intent ID (local)', value: result.payment_intent_id, key: 'intent' },
            { label: 'Razorpay Order ID', value: result.razorpay_order_id, key: 'order' },
            { label: 'Razorpay Payment ID', value: result.razorpay_payment_id, key: 'payment' },
            { label: 'Amount Paid', value: `₹${result.amount} ${result.currency}`, key: null },
            { label: 'Signature Status', value: result.status, key: null },
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
              View Payment Intent Detail Page
            </Link>
            <button onClick={resetForm} className="btn btn-secondary">
              Create Another Order
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
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}
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
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
              Currency
            </label>
            <select
              value={form.currency}
              disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}
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
              disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}
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
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}
                onChange={e => setForm(f => ({ ...f, notes_key: e.target.value }))}
                placeholder="Key (e.g. product_id)"
                style={{ background: '#0A0F1A', border: '1px solid #1E2535', borderRadius: '8px', padding: '10px 14px', color: '#E2E8F0', fontSize: '0.875rem' }}
              />
              <input
                type="text"
                value={form.notes_value}
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}
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
            <button type="submit" className="btn btn-primary" disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED'}>
              <PlusCircle size={15} />
              {uiState === 'CREATING_ORDER' ? 'Creating Order...' : uiState === 'OPENING_CHECKOUT' ? 'Opening Checkout...' : uiState === 'VERIFYING_SIGNATURE' ? 'Verifying...' : 'Create & Pay with Razorpay'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
