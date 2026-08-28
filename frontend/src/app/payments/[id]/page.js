'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { 
  ShieldCheck, 
  Clock, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Search,
  Lock,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentDetailPage() {
  const { id } = useParams();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await api.getPaymentTimeline(id);
      setTimeline(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadTimeline();
  }, [id]);

  const handleTriggerReconcile = async () => {
    setResolving(true);
    setResolveResult(null);
    try {
      const res = await api.reconcilePayment(id);
      setResolveResult(res);
      await loadTimeline();
    } catch (err) {
      alert(`Resolution error: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  const handleVerifyRazorpay = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyWithRazorpay(id);
      setVerifyResult(res);
    } catch (err) {
      alert(`Verification error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748B' }}>
        Fetching Payment Intent & Immutable Evidence...
      </div>
    );
  }

  if (!timeline) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <h2 style={{ color: '#EF4444' }}>Payment Intent Not Found</h2>
        <Link href="/payments" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          ← Back to Payments
        </Link>
      </div>
    );
  }

  const intent = timeline.intent || {};
  const events = timeline.events || [];
  const evidence = timeline.evidence || [];
  const executions = timeline.executions || [];

  return (
    <div>
      {/* Back Link */}
      <Link href="/payments" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748B', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> Back to Payments Registry
      </Link>

      {/* 1. Header Info Banner */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFF', fontFamily: 'monospace', margin: 0 }}>
                {intent.payment_intent_id}
              </h1>
              <StatusBadge status={intent.current_state} />
              {intent.updated_at && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', fontWeight: 600 }}>
                  {new Date(intent.updated_at) > new Date(Date.now() - 300000) ? 'LIVE' : 'STALE'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem', color: '#94A3B8', flexWrap: 'wrap' }}>
              {intent.merchant_reference && <div>Ref: <strong style={{ color: '#FFF' }}>{intent.merchant_reference}</strong></div>}
              {intent.razorpay_order_id && <div>Razorpay Order: <strong style={{ color: '#FFF' }}>{intent.razorpay_order_id}</strong></div>}
              {intent.active_payment_id && <div>Razorpay Payment: <strong style={{ color: '#FFF' }}>{intent.active_payment_id}</strong></div>}
              <div>Active Rail: <strong style={{ color: '#FFF' }}>{intent.active_rail || 'RAZORPAY'}</strong></div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFF' }}>
              {intent.currency} {parseFloat(intent.amount).toFixed(2)}
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleVerifyRazorpay}
                disabled={verifying}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                <Search size={14} />
                {verifying ? 'Verifying...' : 'Verify with Razorpay'}
              </button>
              <button
                onClick={handleTriggerReconcile}
                disabled={resolving}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem' }}
              >
                <Zap size={14} />
                {resolving ? 'Resolving...' : 'Run Resolution Engine'}
              </button>
            </div>
          </div>
        </div>

        {/* Resolution Engine Execution Banner */}
        {resolveResult && (
          <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '8px', background: 'rgba(42, 182, 115, 0.08)', border: '1px solid rgba(42, 182, 115, 0.25)' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2AB673', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> Resolution Engine Completed — Status: {resolveResult.status} | Final State: {resolveResult.final_state}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '4px' }}>
              Policy Decision: {resolveResult.decision} | Action Taken: {resolveResult.action} | Trace ID: {resolveResult.trace_id}
            </div>
          </div>
        )}

        {/* Live Razorpay Snapshot Modal / Panel */}
        {verifyResult && (
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: '#0A0F1A', border: '1px solid #1E2535' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, color: '#2AB673', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={15} /> Live Razorpay API Verification Snapshot
              </div>
              <button onClick={() => setVerifyResult(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '0.8rem' }}>Dismiss</button>
            </div>
            {verifyResult.message && (
              <div style={{ fontSize: '0.8rem', color: '#FBBF24', marginBottom: '10px' }}>{verifyResult.message}</div>
            )}
            <pre style={{ margin: 0, padding: '12px', background: '#070A12', borderRadius: '6px', fontSize: '0.75rem', color: '#60A5FA', overflowX: 'auto' }}>
              {JSON.stringify(verifyResult.razorpay_snapshot || verifyResult.razorpay_order_payments || verifyResult.local_state, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1E2535', marginBottom: '24px' }}>
        {[
          { key: 'timeline', label: `Ingested Events (${events.length})`, icon: Clock },
          { key: 'evidence', label: `Immutable Evidence (${evidence.length})`, icon: Lock },
          { key: 'executions', label: `External Executions (${executions.length})`, icon: ShieldCheck },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                background: 'transparent', border: 'none',
                borderBottom: isActive ? '2px solid #2AB673' : '2px solid transparent',
                color: isActive ? '#2AB673' : '#64748B',
                fontWeight: isActive ? 600 : 400, fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
              No incoming payment events recorded for this intent yet.
            </div>
          ) : (
            events.map((evt, idx) => (
              <div key={evt.event_id} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #2AB673' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.75rem', background: '#1E2535', padding: '2px 8px', borderRadius: '4px', color: '#94A3B8', fontWeight: 600 }}>
                      #{idx + 1}
                    </span>
                    <strong style={{ fontSize: '0.92rem', color: '#FFF' }}>{evt.event_type}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>source: {evt.source}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {new Date(evt.received_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
                  Event ID: {evt.external_event_id} | Trace: {evt.trace_id || 'N/A'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Immutable Evidence */}
      {activeTab === 'evidence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {evidence.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
              No immutable evidence records created yet. Trigger resolution engine to generate evidence.
            </div>
          ) : (
            evidence.map((ev) => (
              <div key={ev.evidence_id} className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={16} color="#2AB673" />
                    <strong style={{ fontSize: '0.92rem', color: '#FFF' }}>Action: {ev.action}</strong>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                      background: ev.decision === 'APPROVE' ? 'rgba(42, 182, 115, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: ev.decision === 'APPROVE' ? '#2AB673' : '#EF4444',
                    }}>
                      POLICY: {ev.decision}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#94A3B8', marginBottom: '12px' }}>
                  Policy Reason: <strong style={{ color: '#FFF' }}>{ev.policy_reason || 'N/A'}</strong>
                </p>

                {ev.decision_chain && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: '#2AB673', fontWeight: 600 }}>
                      Inspect Full Decision Chain (Audit Trail)
                    </summary>
                    <pre style={{ marginTop: '10px', padding: '14px', background: '#0A0F1A', borderRadius: '8px', fontSize: '0.75rem', color: '#60A5FA', overflowX: 'auto' }}>
                      {JSON.stringify(ev.decision_chain, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Executions */}
      {activeTab === 'executions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {executions.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
              No external API executions recorded yet.
            </div>
          ) : (
            executions.map((ex) => (
              <div key={ex.execution_id} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFF' }}>
                    {ex.operation} ({ex.provider} — {ex.rail_id})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                    Txn ID: {ex.external_txn_id || 'N/A'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#FFF' }}>
                    INR {parseFloat(ex.amount).toFixed(2)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: ex.status === 'SUCCESS' ? '#2AB673' : '#EF4444', fontWeight: 600 }}>
                    {ex.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
