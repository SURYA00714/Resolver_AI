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
    setReplayingId(eventId);
    setReplayConfirm(null);
    try {
      const res = await api.replayWebhook(eventId);
      alert(`Webhook Replay Dispatched:\n` + JSON.stringify(res, null, 2));
      await loadData();
    } catch (err) {
      alert(`Replay Error: ${err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const filtered = webhooks.filter((w) => {
    const matchesSearch =
      !search ||
      (w.event_type && w.event_type.toLowerCase().includes(search.toLowerCase())) ||
      (w.external_event_id && w.external_event_id.toLowerCase().includes(search.toLowerCase())) ||
      (w.event_id && w.event_id.toLowerCase().includes(search.toLowerCase()));

    const matchesFilter = !filterType || w.event_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const eventTypes = Array.from(new Set(webhooks.map((w) => w.event_type).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Top Header Banner */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'var(--brand-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}>
            <Webhook size={22} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Webhook Observability Console
              </h1>
              <span style={{
                background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--accent-primary)',
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              }}>
                HMAC VERIFIED
              </span>
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
              Real-time audit stream of incoming Razorpay HTTP webhooks, HMAC signature verification, and deduplication
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', fontWeight: 700 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Stream
        </button>
      </div>

      {/* Diagnostics Cards Row */}
      {diagnostics && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px',
        }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Webhook Endpoint Route
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: diagnostics.route_registered ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <CheckCircle2 size={16} /> Registered (`/webhook/razorpay`)
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              HMAC Secret Configuration
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: diagnostics.webhook_secret_configured ? 'var(--color-success)' : 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              {diagnostics.webhook_secret_configured ? <Lock size={16} /> : <AlertTriangle size={16} />}
              {diagnostics.webhook_secret_configured ? 'Configured (Active)' : 'Not Set (Test Mode)'}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Events Ingested
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {diagnostics.events_received ?? webhooks.length}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Verified Signatures
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'monospace' }}>
              {diagnostics.verified_events ?? 0}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Rejected Attempts
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'monospace' }}>
              {diagnostics.rejected_events ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{
        padding: '12px 18px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Event Type, External Event ID, or Internal ID..."
            style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)',
              border: '1px solid var(--border-color)', borderRadius: '6px',
              padding: '9px 12px 9px 36px', color: 'var(--text-primary)', fontSize: '0.85rem',
              outline: 'none', fontWeight: 500,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-color)',
              borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '0.83rem',
              outline: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            <option value="">All Event Types ({webhooks.length})</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* Replay Confirmation Modal */}
      {replayConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ padding: '24px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: 'var(--color-warning)' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Confirm Internal Event Replay</h3>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', fontSize: '0.78rem', color: 'var(--color-warning)', fontWeight: 800, marginBottom: '16px' }}>
              INTERNAL REPLAY — NOT A RAZORPAY REDELIVERY
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Replaying this event re-evaluates local state machine transitions and triggers outbox task creation based on the saved evidence payload. It does NOT trigger HTTP calls from Razorpay servers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setReplayConfirm(null)} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={() => handleReplay(replayConfirm)} className="btn btn-primary btn-sm">Confirm Replay</button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Fetching webhook logs...' : 'No webhook events recorded yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.event_id || item.external_event_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {item.event_type}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.external_event_id}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800,
                      background: item.signature_verified ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: item.signature_verified ? 'var(--color-success)' : 'var(--color-danger)',
                      border: `1px solid ${item.signature_verified ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                    }}>
                      {item.signature_verified ? 'VERIFIED SIGNATURE' : 'UNVERIFIED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ProvenanceBadge type={item.source === 'RAZORPAY' ? 'REAL_WEBHOOK' : 'LOCAL_SIMULATION'} size="small" />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {item.received_at ? new Date(item.received_at).toLocaleString() : 'N/A'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedWebhook(item)}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Code size={12} /> View Payload
                      </button>
                      <button
                        onClick={() => setReplayConfirm(item.event_id)}
                        disabled={replayingId === item.event_id}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RotateCcw size={12} className={replayingId === item.event_id ? 'spin' : ''} /> Replay
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ padding: '24px', width: '650px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="var(--accent-primary)" />
                Webhook Payload Inspector — {selectedWebhook.event_type}
              </div>
              <button onClick={() => setSelectedWebhook(null)} className="btn btn-secondary btn-sm">Close</button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '12px' }}>
              External Event ID: {selectedWebhook.external_event_id} | Trace: {selectedWebhook.trace_id || 'N/A'}
            </div>

            <pre style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)', overflowX: 'auto', margin: 0, border: '1px solid var(--border-color)' }}>
              {JSON.stringify(selectedWebhook.payload || selectedWebhook, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
