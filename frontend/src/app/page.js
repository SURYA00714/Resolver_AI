'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BuildathonHeader from '@/components/BuildathonHeader';
import StatusBadge from '@/components/StatusBadge';
import ProvenanceBadge from '@/components/ProvenanceBadge';

import {
  CreditCard, AlertTriangle, RefreshCw, Activity,
  ArrowRight, ShieldCheck, CheckCircle2, BarChart3, Clock, Cpu,
  ArrowUpRight, ArrowDownRight, Inbox,
} from 'lucide-react';
import Link from 'next/link';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Widget visibility preferences from settings
  const [widgets, setWidgets] = useState({
    showResilienceBanner: true,
    showKpis: true,
    showCharts: true,
    showRecentActivity: true,
    showRecentPayments: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check widget preferences
    const stored = localStorage.getItem('resolverai_dashboard_widgets');
    if (stored) {
      try {
        setWidgets(prev => ({ ...prev, ...JSON.parse(stored) }));
      } catch (e) {}
    }

    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const kpis = stats?.executive_kpis || {};
  const stateDist = stats?.state_distribution || [];
  const recentEvents = stats?.recent_events || [];

  const KpiCard = ({ icon: Icon, label, value, change, changeDir }) => (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span className="kpi-label" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
        <Icon size={16} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
      </div>
      <div className="kpi-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{value}</div>
      {change && (
        <div className="kpi-change" style={{ color: changeDir === 'up' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {changeDir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {change}
        </div>
      )}
    </div>
  );

  const totalIntents = kpis.total_intents || 0;
  const resolved = kpis.successfully_resolved || 0;
  const successRate = totalIntents > 0 ? ((resolved / totalIntents) * 100).toFixed(1) : '0.0';
  const uncertainCount = kpis.uncertain_intents || 0;
  const autoHealed = kpis.auto_healed || 0;

  return (
    <div style={{ paddingBottom: '40px' }}>
      <BuildathonHeader loading={loading} loadData={loadData} />

      {/* SYSTEM RESILIENCE Banner */}
      {widgets.showResilienceBanner && (
        <div className="card" style={{
          padding: '14px 20px', marginBottom: '20px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '4px 10px' }}>
              <ShieldCheck size={14} /> SYSTEM RESILIENCE
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Deterministic 3-Way Reconciliation Active • Capability Token Signatures Enforced • ₹0.00 Real Money Impact
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Policy Guard: <strong style={{ color: 'var(--color-success)' }}>ONLINE</strong></span>
            <span>Outbox Crash Recovery: <strong style={{ color: 'var(--accent-primary)' }}>ACTIVE</strong></span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '20px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: 'var(--color-danger)', fontSize: '0.8125rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="btn btn-secondary btn-sm">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !stats && (
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton skeleton-card" style={{ borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      )}

      {/* KPI Row */}
      {widgets.showKpis && (!loading || stats) && (
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <KpiCard icon={CreditCard} label="TOTAL PAYMENT INTENTS" value={totalIntents.toLocaleString()} />
          <KpiCard icon={CheckCircle2} label="SUCCESS RATE" value={`${successRate}%`}
            change={totalIntents > 0 ? 'of resolved' : undefined} changeDir="up" />
          <KpiCard icon={AlertTriangle} label="UNCERTAIN INTENTS" value={uncertainCount.toLocaleString()} />
          <KpiCard icon={Cpu} label="AUTO-HEALED" value={autoHealed.toLocaleString()} />
          <KpiCard icon={Activity} label="WEBHOOK EVENTS" value={(kpis.webhook_count || 0).toLocaleString()} />
        </div>
      )}

      {/* Charts & Activity Row */}
      {(widgets.showCharts || widgets.showRecentActivity) && (
        <div style={{ display: 'grid', gridTemplateColumns: widgets.showCharts && widgets.showRecentActivity ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '24px' }}>
          {/* State Distribution */}
          {widgets.showCharts && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
                marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
                Payment State Distribution
              </div>
              {stateDist.length > 0 ? (
                <div style={{ height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stateDist}>
                      <XAxis dataKey="state" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                        }}
                      />
                      <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <BarChart3 size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <div className="empty-state-desc">No state data yet. Initiate a transaction to observe distribution.</div>
                </div>
              )}
            </div>
          )}

          {/* System Activity */}
          {widgets.showRecentActivity && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
                marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
                Recent System Activity
              </div>
              {recentEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentEvents.slice(0, 5).map((evt, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-hover)', fontSize: '0.8125rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {evt.payment_intent_id?.slice(0, 16) || '—'}
                        </span>
                        <StatusBadge status={evt.current_state || 'CREATED'} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{parseFloat(evt.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <Inbox size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <div className="empty-state-desc">No recent activity. Ingested webhooks will appear here.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Payments Table */}
      {widgets.showRecentPayments && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px',
          }}>
            <div style={{
              fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
              Authoritative Payment Records
            </div>
            <Link href="/payments" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Amount</th>
                  <th>Provider</th>
                  <th>State</th>
                  <th>Provenance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state" style={{ padding: '24px' }}>
                        <div className="empty-state-desc">No payment intents recorded yet. Create an order to begin.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentEvents.slice(0, 5).map((evt) => (
                    <tr key={evt.payment_intent_id}>
                      <td><code style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{evt.payment_intent_id}</code></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>₹{parseFloat(evt.amount || 0).toFixed(2)}</td>
                      <td><span className="badge badge-neutral">Razorpay</span></td>
                      <td><StatusBadge status={evt.current_state || 'CREATED'} /></td>
                      <td><ProvenanceBadge type={evt.provenance || 'POLICY_ENGINE'} size="small" /></td>
                      <td>
                        <Link href={`/payments/${evt.payment_intent_id}`} className="btn btn-ghost btn-sm">
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
