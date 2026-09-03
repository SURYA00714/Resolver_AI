'use client';

import { useState } from 'react';
import Script from 'next/script';
import { api } from '@/lib/api';
import { PlusCircle, AlertTriangle, CheckCircle2, ExternalLink, Copy, RefreshCw, CreditCard, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
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
  const [uiState, setUiState] = useState('IDLE'); // IDLE | CREATING_ORDER | OPENING_CHECKOUT | VERIFYING_SIGNATURE | PAYMENT_SUCCESSFUL | PAYMENT_FAILED | SIGNATURE_FAILED | VERIFICATION_NETWORK_FAILED
  const [result, setResult] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [copied, setCopied] = useState(null);
  const [retryPayload, setRetryPayload] = useState(null);

  const executeSignatureVerification = async (verifyData, orderInfo) => {
    setUiState('VERIFYING_SIGNATURE');
    setErrorDetails(null);

    try {
      const verifyRes = await api.verifyPayment({
        razorpay_order_id: verifyData.razorpay_order_id,
        razorpay_payment_id: verifyData.razorpay_payment_id,
        razorpay_signature: verifyData.razorpay_signature,
        payment_intent_id: orderInfo.payment_intent_id,
      });

      setResult({
        payment_intent_id: orderInfo.payment_intent_id,
        razorpay_order_id: verifyData.razorpay_order_id,
        razorpay_payment_id: verifyData.razorpay_payment_id,
        status: verifyRes.status || 'VERIFIED',
        amount: orderInfo.amount,
        currency: orderInfo.currency,
      });
      setUiState('PAYMENT_SUCCESSFUL');
      setRetryPayload(null);
    } catch (err) {
      const msg = err.message || 'Signature verification failed';
      setRetryPayload({ verifyData, orderInfo });

      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        setErrorDetails({
          title: 'Verification Connection Failure',
          message: 'Unable to reach backend verification service. The payment intent remains preserved in server DB.',
          raw: msg,
          order_id: verifyData.razorpay_order_id,
          payment_id: verifyData.razorpay_payment_id,
          intent_id: orderInfo.payment_intent_id,
        });
        setUiState('VERIFICATION_NETWORK_FAILED');
      } else {
        setErrorDetails({
          title: 'HMAC Signature Verification Failed',
          message: 'The signature returned by Razorpay Checkout does not match server HMAC computation.',
          raw: msg,
          order_id: verifyData.razorpay_order_id,
          payment_id: verifyData.razorpay_payment_id,
          intent_id: orderInfo.payment_intent_id,
        });
        setUiState('SIGNATURE_FAILED');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      setErrorDetails({ title: 'Invalid Input', message: 'Amount must be a positive number in INR.', raw: '' });
      setUiState('PAYMENT_FAILED');
      return;
    }

    setUiState('CREATING_ORDER');
    setErrorDetails(null);
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
      setErrorDetails({ title: 'Order Creation Failed', message: err.message || 'Failed to create Razorpay order.', raw: '' });
      setUiState('PAYMENT_FAILED');
      return;
    }

    setUiState('OPENING_CHECKOUT');
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setErrorDetails({ title: 'SDK Script Error', message: 'Failed to load Razorpay Checkout SDK script.', raw: '' });
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
        await executeSignatureVerification(response, orderRes);
      },
      modal: {
        ondismiss: function () {
          setUiState((current) => {
            if (current !== 'PAYMENT_SUCCESSFUL' && current !== 'VERIFYING_SIGNATURE' && current !== 'SIGNATURE_FAILED' && current !== 'VERIFICATION_NETWORK_FAILED') {
              setErrorDetails({ title: 'Checkout Dismissed', message: 'Payment checkout modal was closed before completing payment.', raw: '' });
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
        setErrorDetails({ title: 'Payment Failed', message: failureReason, raw: JSON.stringify(resp.error || {}) });
        setUiState('PAYMENT_FAILED');
      });
      rzp.open();
    } catch (err) {
      setErrorDetails({ title: 'Checkout Initialization Error', message: `Failed to open Razorpay Checkout: ${err.message}`, raw: '' });
      setUiState('PAYMENT_FAILED');
    }
  };

  const handleRetryVerification = () => {
    if (retryPayload) {
      executeSignatureVerification(retryPayload.verifyData, retryPayload.orderInfo);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetForm = () => {
    setResult(null);
    setErrorDetails(null);
    setRetryPayload(null);
    setUiState('IDLE');
    setForm({ amount: '', currency: 'INR', receipt: '', notes_key: '', notes_value: '' });
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <CreditCard size={22} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Create Order & Razorpay Checkout
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
          Creates a real order via <code>POST /orders</code> and opens Razorpay Checkout modal for real-time payment & signature verification.
        </p>
      </div>

      {/* Loading / Active State Banners */}
      {(uiState === 'CREATING_ORDER' || uiState === 'OPENING_CHECKOUT' || uiState === 'VERIFYING_SIGNATURE') && (
        <div style={{
          padding: '16px 20px', marginBottom: '24px', borderRadius: '10px',
          background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex', alignItems: 'center', gap: '12px', color: '#60A5FA',
        }}>
          {uiState === 'CREATING_ORDER' && <RefreshCw size={20} className="spin" />}
          {uiState === 'OPENING_CHECKOUT' && <CreditCard size={20} className="pulse-active" />}
          {uiState === 'VERIFYING_SIGNATURE' && <Lock size={20} className="spin" />}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {uiState === 'CREATING_ORDER' && 'Creating Real Razorpay Order (POST /orders)...'}
              {uiState === 'OPENING_CHECKOUT' && 'Opening Razorpay Checkout Modal...'}
              {uiState === 'VERIFYING_SIGNATURE' && 'Verifying Server HMAC Signature (POST /orders/verify_payment)...'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Executing secure single-tenant verification pipeline.
            </div>
          </div>
        </div>
      )}

      {/* Verification Failure Diagnostic Card */}
      {(uiState === 'SIGNATURE_FAILED' || uiState === 'VERIFICATION_NETWORK_FAILED' || uiState === 'PAYMENT_FAILED') && errorDetails && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#EF4444' }}>
            <AlertTriangle size={22} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
              {errorDetails.title}
            </h3>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
            {errorDetails.message}
          </p>

          {errorDetails.order_id && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>Order ID: <strong style={{ color: 'var(--text-primary)' }}>{errorDetails.order_id}</strong></div>
              <div>Payment ID: <strong style={{ color: 'var(--text-primary)' }}>{errorDetails.payment_id}</strong></div>
              <div>Payment Intent: <strong style={{ color: 'var(--accent-primary)' }}>{errorDetails.intent_id}</strong></div>
              {errorDetails.raw && <div style={{ color: '#F87171', marginTop: '4px' }}>Detail: {errorDetails.raw}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {retryPayload && (
              <button onClick={handleRetryVerification} className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                <RotateCcw size={14} /> Retry Verification
              </button>
            )}
            {errorDetails.intent_id && (
              <Link href={`/payments/${errorDetails.intent_id}`} className="btn btn-secondary" style={{ fontSize: '0.82rem', textDecoration: 'none' }}>
                <ExternalLink size={14} /> Inspect Payment Intent
              </Link>
            )}
            <button onClick={resetForm} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
              Reset Form
            </button>
          </div>
        </div>
      )}

      {/* Success View */}
      {uiState === 'PAYMENT_SUCCESSFUL' && result ? (
        <div style={{
          padding: '24px', borderRadius: '12px',
          background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <CheckCircle2 size={22} color="#22C55E" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#22C55E', margin: 0 }}>
              Payment Successful & HMAC Signature Verified!
            </h2>
          </div>

          {[
            { label: 'Payment Intent ID (local)', value: result.payment_intent_id, key: 'intent' },
            { label: 'Razorpay Order ID', value: result.razorpay_order_id, key: 'order' },
            { label: 'Razorpay Payment ID', value: result.razorpay_payment_id, key: 'payment' },
            { label: 'Amount Paid', value: `₹${result.amount} ${result.currency}`, key: null },
            { label: 'Verification Status', value: result.status, key: null },
          ].map(({ label, value, key }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(34, 197, 94, 0.15)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>{value}</code>
                {key && (
                  <button onClick={() => copy(value, key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === key ? '#22C55E' : 'var(--text-muted)' }}>
                    <Copy size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            <Link href={`/payments/${result.payment_intent_id}`} className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ExternalLink size={14} />
              View Payment Investigation Command Center
            </Link>
            <button onClick={resetForm} className="btn btn-secondary">
              Create Another Order
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Amount (INR) *
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 700 }}>₹</span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="499.00"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
                  padding: '12px 14px 12px 32px', color: 'var(--text-primary)', fontSize: '0.95rem',
                  outline: 'none', fontWeight: 600,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Currency
            </label>
            <select
              value={form.currency}
              disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              style={{
                width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '12px 14px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            >
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Receipt / Reference Number
            </label>
            <input
              type="text"
              value={form.receipt}
              disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}
              onChange={e => setForm(f => ({ ...f, receipt: e.target.value }))}
              placeholder="receipt_2024_001 (optional)"
              maxLength={100}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px',
                padding: '12px 14px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Notes (optional key-value metadata)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="text"
                value={form.notes_key}
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}
                onChange={e => setForm(f => ({ ...f, notes_key: e.target.value }))}
                placeholder="Key (e.g. product_id)"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
              />
              <input
                type="text"
                value={form.notes_value}
                disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}
                onChange={e => setForm(f => ({ ...f, notes_value: e.target.value }))}
                placeholder="Value (e.g. prod_xyz)"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Link href="/payments" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={uiState !== 'IDLE' && uiState !== 'PAYMENT_FAILED' && uiState !== 'SIGNATURE_FAILED' && uiState !== 'VERIFICATION_NETWORK_FAILED'}>
              <PlusCircle size={15} />
              {uiState === 'CREATING_ORDER' ? 'Creating Order...' : uiState === 'OPENING_CHECKOUT' ? 'Opening Checkout...' : uiState === 'VERIFYING_SIGNATURE' ? 'Verifying Signature...' : 'Create Order & Pay with Razorpay'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
