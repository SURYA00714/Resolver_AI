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
  const [replayConfirm, setReplayConfirm] = useState(null);

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
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}>
            <Webhook size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                Webhook Observability Console
              </h1>
              <span style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              }}>
                HMAC VERIFIED
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
              Real-time audit stream of incoming Razorpay HTTP webhooks, HMAC signature verification, and deduplication
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          style={{
            background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155',
            padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Stream
        </button>
      </div>

      {/* Diagnostics Cards Row */}
      {diagnostics && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px',
        }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Webhook Endpoint Route
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: diagnostics.route_registered ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <CheckCircle2 size={16} /> Registered (`/webhook/razorpay`)
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              HMAC Secret Configuration
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: diagnostics.webhook_secret_configured ? '#16A34A' : '#D97706', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {diagnostics.webhook_secret_configured ? <Lock size={16} /> : <AlertTriangle size={16} />}
              {diagnostics.webhook_secret_configured ? 'Configured (Active)' : 'Not Set (Test Mode)'}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Events Ingested
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
              {diagnostics.events_received ?? webhooks.length}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Verified Signatures
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16A34A', fontFamily: 'monospace' }}>
              {diagnostics.verified_events ?? 0}
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Rejected Attempts
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#DC2626', fontFamily: 'monospace' }}>
              {diagnostics.rejected_events ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 18px',
        display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Event ID, Type, or Payment Intent ID..."
            style={{
              width: '100%', boxSizing: 'border-box', background: '#F8FAFC',
              border: '1px solid #CBD5E1', borderRadius: '6px',
              padding: '9px 12px 9px 36px', color: '#0F172A', fontSize: '0.85rem',
              outline: 'none', fontWeight: 500,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="#64748B" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: '#F8FAFC', border: '1px solid #CBD5E1',
              borderRadius: '6px', padding: '8px 12px', color: '#0F172A', fontSize: '0.83rem',
              outline: 'none', cursor: 'pointer', fontWeight: 600,
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '24px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#D97706' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>Confirm Internal Event Replay</h3>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#FEF3C7', border: '1px solid #FDE047', fontSize: '0.78rem', color: '#B45309', fontWeight: 800, marginBottom: '16px' }}>
              INTERNAL REPLAY — NOT A RAZORPAY REDELIVERY
            </div>
            <p style={{ fontSize: '0.83rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Replaying this event re-evaluates local state machine transitions and triggers outbox task creation based on the saved evidence payload. It does NOT trigger HTTP calls from Razorpay servers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setReplayConfirm(null)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '8px 16px', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleReplay(replayConfirm)} style={{ background: '#2563EB', border: 'none', color: '#FFFFFF', padding: '8px 16px', borderRadius: '6px', fontSize: '0.83rem', fontWeight: 800, cursor: 'pointer' }}>Confirm Replay</button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Event Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>External Event ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Signature Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Provenance</th>
              <th style={{ padding: '12px 16px', fontWeight: 800 }}>Received At</th>
              <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  {loading ? 'Fetching webhook logs...' : 'No webhook events recorded yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.event_id || item.external_event_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A' }}>
                    {item.event_type}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                    {item.external_event_id}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800,
                      background: item.signature_verified ? '#DCFCE7' : '#FEE2E2',
                      color: item.signature_verified ? '#15803D' : '#B91C1C',
                      border: `1px solid ${item.signature_verified ? '#86EFAC' : '#FCA5A5'}`,
                    }}>
                      {item.signature_verified ? 'VERIFIED SIGNATURE' : 'UNVERIFIED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ProvenanceBadge type={item.source === 'RAZORPAY' ? 'REAL_WEBHOOK' : 'LOCAL_SIMULATION'} size="small" />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                    {item.received_at ? new Date(item.received_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedWebhook(item)}
                        style={{
                          background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155',
                          padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        <Code size={12} /> View Payload
                      </button>
                      <button
                        onClick={() => setReplayConfirm(item.event_id)}
                        disabled={replayingId === item.event_id}
                        style={{
                          background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155',
                          padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        }}
                      >
                        <RotateCcw size={12} /> Replay
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '24px', width: '650px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="#2563EB" />
                Webhook Payload Inspector — {selectedWebhook.event_type}
              </div>
              <button onClick={() => setSelectedWebhook(null)} style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace', marginBottom: '12px' }}>
              External Event ID: {selectedWebhook.external_event_id} | Trace: {selectedWebhook.trace_id || 'N/A'}
            </div>

            <pre style={{ padding: '16px', background: '#0F172A', borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', color: '#38BDF8', overflowX: 'auto', margin: 0, border: '1px solid #1E293B' }}>
              {JSON.stringify(selectedWebhook.payload || selectedWebhook, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
