'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { 
  ShieldCheck, 
  Clock, 
  FileCode, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Search,
  Lock
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentDetailPage() {
  const { id } = useParams();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState(null);

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

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
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
      <Link href="/payments" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '20px' }}>
        <ArrowLeft size={16} /> Back to Payments Registry
      </Link>

      {/* Header Info Banner */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFF', fontFamily: 'JetBrains Mono, monospace' }}>
                {intent.payment_intent_id}
              </h1>
              <StatusBadge status={intent.current_state} />
            </div>

            <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>Order ID: <strong style={{ color: '#FFF' }}>{intent.order_id}</strong></div>
              {intent.razorpay_order_id && <div>Razorpay Order: <strong style={{ color: '#FFF' }}>{intent.razorpay_order_id}</strong></div>}
              {intent.active_payment_id && <div>Razorpay Payment: <strong style={{ color: '#FFF' }}>{intent.active_payment_id}</strong></div>}
              <div>Rail: <strong style={{ color: '#FFF' }}>{intent.active_rail || 'RAZORPAY_TEST'}</strong></div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFF' }}>
              {intent.currency} {parseFloat(intent.amount).toFixed(2)}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={handleTriggerReconcile}
                disabled={resolving}
                className="btn btn-primary"
              >
                <Zap size={16} />
                {resolving ? 'Running Resolution Engine...' : 'Run Resolution Engine'}
              </button>
            </div>
          </div>
        </div>

        {resolveResult && (
          <div style={{ marginTop: '20px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(42, 182, 115, 0.1)', border: '1px solid var(--border-active)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2AB673' }}>
              Resolution Pipeline Executed → Result: {resolveResult.status} | Final State: {resolveResult.final_state}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Policy Decision: {resolveResult.decision} | Action Taken: {resolveResult.action} | Trace ID: {resolveResult.trace_id}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        {[
          { key: 'timeline', label: `Chronological Timeline (${events.length})`, icon: Clock },
          { key: 'evidence', label: `Immutable Evidence Trail (${evidence.length})`, icon: Lock },
          { key: 'executions', label: `External Executions (${executions.length})`, icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #2AB673' : '2px solid transparent',
                color: isActive ? '#2AB673' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {events.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No incoming payment events recorded for this intent yet.
            </div>
          ) : (
            events.map((evt, idx) => (
              <div key={evt.event_id} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #2AB673' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', background: 'var(--bg-surface-hover)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      Step #{idx + 1}
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#FFF' }}>{evt.event_type}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>via {evt.source}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(evt.received_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  Event ID: {evt.external_event_id} | Trace ID: {evt.trace_id || 'N/A'}
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
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No immutable evidence records created yet. Trigger resolution to evaluate 5-rule policy.
            </div>
          ) : (
            evidence.map((ev) => (
              <div key={ev.evidence_id} className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={16} color="#2AB673" />
                    <strong style={{ fontSize: '0.95rem', color: '#FFF' }}>Action: {ev.action}</strong>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: ev.decision === 'APPROVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: ev.decision === 'APPROVE' ? '#22C55E' : '#EF4444',
                    }}>
                      POLICY: {ev.decision}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Policy Reason: <strong style={{ color: '#FFF' }}>{ev.policy_reason || 'N/A'}</strong>
                </p>

                {ev.decision_chain && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#2AB673', fontWeight: 600 }}>
                      Inspect Full Decision Chain (Audit Evidence)
                    </summary>
                    <pre style={{
                      marginTop: '10px',
                      padding: '14px',
                      background: 'var(--bg-primary)',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      color: '#A7F3D0',
                      overflowX: 'auto',
                    }}>
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
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No external API executions recorded yet.
            </div>
          ) : (
            executions.map((ex) => (
              <div key={ex.execution_id} className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFF' }}>
                    {ex.operation} ({ex.provider} — {ex.rail_id})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    Txn ID: {ex.external_txn_id || 'N/A'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#FFF' }}>
                    INR {parseFloat(ex.amount).toFixed(2)}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: ex.status === 'SUCCESS' ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
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
