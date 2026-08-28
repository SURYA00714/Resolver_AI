'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { 
  Webhook, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronRight,
  Play,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState([]);
  const [deadLetters, setDeadLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [replayingId, setReplayingId] = useState(null);
  const [tab, setTab] = useState('webhooks'); // 'webhooks' | 'dead-letters'
  const [filter, setFilter] = useState({ event_type: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wh, dl] = await Promise.all([
        api.getWebhooks({ limit: 200, ...filter }),
        api.getDeadLetters(),
      ]);
      setWebhooks(wh.items || []);
      setDeadLetters(Array.isArray(dl) ? dl : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReplay = async (eventId) => {
    if (!confirm('Replay this event through the resolution pipeline? This is an INTERNAL REPLAY — not a re-delivery from Razorpay.')) return;
    setReplayingId(eventId);
    try {
      await api.replayWebhook(eventId);
      alert('Event queued for replay. Check the outbox worker logs.');
      load();
    } catch (err) {
      alert(`Replay failed: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const sigColor = (v) => v === false ? '#EF4444' : '#2AB673';
  const sigIcon = (v) => v === false
    ? <XCircle size={15} color="#EF4444" />
    : <CheckCircle2 size={15} color="#2AB673" />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Webhook size={22} color="#2AB673" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
              Webhook History
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
            All received webhook events. Source=RAZORPAY are real; source=SYNTHETIC are test injections.
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '14px 20px', marginBottom: '24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontSize: '0.875rem' }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #1E2535', paddingBottom: '0' }}>
        {['webhooks', 'dead-letters'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#2AB673' : '#64748B',
            borderBottom: tab === t ? '2px solid #2AB673' : '2px solid transparent',
            marginBottom: '-1px',
          }}>
            {t === 'dead-letters' ? `Dead Letters (${deadLetters.length})` : `Events (${webhooks.length})`}
          </button>
        ))}
      </div>

      {tab === 'webhooks' && (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {webhooks.length === 0 && !loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#475569' }}>
              <Inbox size={40} color="#1E2535" style={{ marginBottom: '12px' }} />
              <div>No webhook events found.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                Events appear here when Razorpay sends a webhook to <code>POST /webhook/razorpay</code>
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0A0F1A', borderBottom: '1px solid #1E2535' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>EVENT TYPE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>SOURCE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>PAYMENT INTENT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>SIG VERIFIED</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>RECEIVED</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w, i) => (
                  <tr key={w.event_id} style={{
                    borderBottom: '1px solid #0E1826',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(14, 24, 38, 0.4)',
                    transition: 'background 0.1s',
                  }}>
                    <td style={{ padding: '12px 16px', color: '#E2E8F0', fontWeight: 500 }}>
                      {w.event_type}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                        background: w.source === 'RAZORPAY' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                        color: w.source === 'RAZORPAY' ? '#60A5FA' : '#FBBF24',
                      }}>
                        {w.source || 'UNKNOWN'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94A3B8' }}>
                      {w.payment_intent_id
                        ? <Link href={`/payments/${w.payment_intent_id}`} style={{ color: '#60A5FA', textDecoration: 'none' }}>
                            {w.payment_intent_id.slice(0, 18)}…
                          </Link>
                        : '—'
                      }
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: sigColor(w.signature_verified) }}>
                        {sigIcon(w.signature_verified)}
                        {w.signature_verified === false ? 'Failed' : 'Verified'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '0.78rem' }}>
                      {new Date(w.received_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Link href={`/webhooks/${w.event_id}`} style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem',
                          background: '#1E2535', color: '#94A3B8', textDecoration: 'none',
                          display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                          Detail <ChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => handleReplay(w.event_id)}
                          disabled={replayingId === w.event_id}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem',
                            background: 'rgba(42, 182, 115, 0.1)', color: '#2AB673',
                            border: '1px solid rgba(42, 182, 115, 0.2)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <Play size={11} />
                          {replayingId === w.event_id ? 'Queuing...' : 'Replay'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'dead-letters' && (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          {deadLetters.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#475569' }}>
              <CheckCircle2 size={40} color="#2AB673" style={{ marginBottom: '12px' }} />
              <div style={{ color: '#2AB673', fontWeight: 600 }}>No dead-letter events.</div>
              <div style={{ fontSize: '0.8rem', marginTop: '6px' }}>All outbox events have been processed successfully.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0A0F1A', borderBottom: '1px solid #1E2535' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>EVENT TYPE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>PAYMENT INTENT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>ATTEMPTS</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>LAST ERROR</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map((dl, i) => (
                  <tr key={dl.outbox_id} style={{ borderBottom: '1px solid #0E1826', background: i % 2 === 0 ? 'transparent' : 'rgba(239, 68, 68, 0.03)' }}>
                    <td style={{ padding: '12px 16px', color: '#F87171', fontWeight: 500 }}>{dl.event_type}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94A3B8' }}>
                      {dl.aggregate_id?.slice(0, 18)}…
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#F87171', fontWeight: 700 }}>{dl.attempts}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '0.78rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dl.last_error || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '0.78rem' }}>
                      {new Date(dl.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
