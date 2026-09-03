'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import {
  Webhook,
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export default function WebhookObservabilityPage() {
  const [webhooks, setWebhooks] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [replayingId, setReplayingId] = useState(null);
  const [replayConfirm, setReplayConfirm] = useState(null); // event_id

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [whData, diagData] = await Promise.all([
        api.getWebhooks().catch(() => ({ items: [] })),
        api.getWebhookDiagnostics().catch(() => null),
      ]);
      setWebhooks(whData.items || whData || []);
      setDiagnostics(diagData);
    } catch (err) {
      setError(err.message || 'Failed to fetch webhook logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReplay = async (eventId) => {
    setReplayConfirm(null);
    setReplayingId(eventId);
    try {
      const res = await api.replayWebhook(eventId);
      alert(`Internal Replay Result for ${eventId.slice(0, 10)}:\n` + JSON.stringify(res, null, 2));
      await loadData();
    } catch (err) {
      alert(`Replay Error: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const filtered = webhooks.filter((w) => {
    if (filterType && w.event_type !== filterType) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (w.event_id && w.event_id.toLowerCase().includes(term)) ||
      (w.event_type && w.event_type.toLowerCase().includes(term)) ||
      (w.external_event_id && w.external_event_id.toLowerCase().includes(term)) ||
      (w.payment_intent_id && w.payment_intent_id.toLowerCase().includes(term))
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Webhook size={22} color="var(--accent-primary)" />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Webhook Observability Console
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time audit log of incoming Razorpay HTTP webhooks, HMAC signature verification, and deduplication.
          </p>
        </div>

        <button onClick={loadData} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Refresh Stream
        </button>
      </div>

      {/* Diagnostics Header Banner */}
      {diagnostics && (
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Webhook Endpoint Route</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: diagnostics.route_registered ? '#22C55E' : '#EF4444', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <CheckCircle2 size={16} /> Registered (`/webhook/razorpay`)
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Webhook Secret Configured</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: diagnostics.webhook_secret_configured ? '#22C55E' : '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {diagnostics.webhook_secret_configured ? <Lock size={16} /> : <AlertTriangle size={16} />}
              {diagnostics.webhook_secret_configured ? 'Configured (Active)' : 'Not Set (Test Mode)'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Events Ingested</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {diagnostics.events_received ?? webhooks.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Verified Signatures</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22C55E', marginTop: '2px' }}>
              {diagnostics.verified_events ?? 0}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Rejected Attempts</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#EF4444', marginTop: '2px' }}>
              {diagnostics.rejected_events ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Event ID, Type, or Payment Intent ID..."
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.875rem',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Webhook Event Types</option>
            <option value="payment.captured">payment.captured</option>
            <option value="payment.failed">payment.failed</option>
            <option value="payment.authorized">payment.authorized</option>
            <option value="refund.processed">refund.processed</option>
            <option value="payment.dispute.created">payment.dispute.created</option>
          </select>
        </div>
      </div>

      {/* Internal Replay Warning Modal */}
      {replayConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '28px', width: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#F59E0B' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Confirm Internal Event Replay</h3>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.82rem', color: '#FBBF24', fontWeight: 700, marginBottom: '16px' }}>
              INTERNAL REPLAY — NOT A RAZORPAY REDELIVERY
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Replaying this event re-evaluates local state machine transitions and triggers outbox task creation based on the saved evidence payload. It does NOT trigger HTTP calls from Razorpay servers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setReplayConfirm(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => handleReplay(replayConfirm)} className="btn btn-primary">Confirm Internal Replay</button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Event Type</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>External Event ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Signature Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Provenance</th>
              <th style={{ padding: '14px 18px', fontWeight: 700 }}>Received At</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Fetching webhook logs...' : 'No webhook events recorded yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.event_id || item.external_event_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.event_type}
                  </td>
                  <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.external_event_id}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                      background: item.signature_verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: item.signature_verified ? '#22C55E' : '#EF4444',
                    }}>
                      {item.signature_verified ? 'SIGNATURE VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <ProvenanceBadge type={item.source === 'RAZORPAY' ? 'REAL_WEBHOOK' : 'LOCAL_SIMULATION'} size="small" />
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {item.received_at ? new Date(item.received_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedWebhook(item)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        <Code size={13} />
                        View Payload
                      </button>
                      <button
                        onClick={() => setReplayConfirm(item.event_id)}
                        disabled={replayingId === item.event_id}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        <RotateCcw size={13} />
                        Replay
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payload Inspection Modal */}
      {selectedWebhook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: '28px', width: '650px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="var(--accent-primary)" />
                Webhook Payload Inspector — {selectedWebhook.event_type}
              </div>
              <button onClick={() => setSelectedWebhook(null)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Close</button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '12px' }}>
              External Event ID: {selectedWebhook.external_event_id} | Trace: {selectedWebhook.trace_id || 'N/A'}
            </div>

            <pre style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.78rem', color: '#60A5FA', overflowX: 'auto', margin: 0 }}>
              {JSON.stringify(selectedWebhook.payload || selectedWebhook, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
