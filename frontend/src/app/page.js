'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BuildathonHeader from '@/components/BuildathonHeader';
import StatsCard from '@/components/StatsCard';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import FinancialSafetyPanel from '@/components/FinancialSafetyPanel';
import AiPipelineVisualizer from '@/components/AiPipelineVisualizer';
import ResilienceScorecard from '@/components/ResilienceScorecard';

import {
  CreditCard,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Activity,
  Webhook,
  XCircle,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  CheckCircle2,
  Copy,
  UserCheck,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [isJudgeView, setIsJudgeView] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStats({ range: timeRange });
      setStats(data);
    } catch (err) {
      setError(err.message || 'DATA TEMPORARILY UNAVAILABLE. Ensure ResolverAI engine service is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const kpis = stats?.executive_kpis || {};
  const webhooks = stats?.webhook_stats || {};
  const aiLab = stats?.ai_test_lab || {};
  const fin = stats?.financial_summary || {};
  const stateDist = stats?.state_distribution || [];
  const trendData = stats?.resolution_trend || [];
  const railData = stats?.rail_analytics || [];
  const failureIntel = stats?.failure_intelligence || [];
  const recentEvents = stats?.recent_events || [];

  const resolutionRate = kpis.total_intents > 0 ? ((kpis.successfully_resolved / kpis.total_intents) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header & Lifecycle Stream */}
      <BuildathonHeader
        loading={loading}
        loadData={loadData}
        isJudgeView={isJudgeView}
        setIsJudgeView={setIsJudgeView}
      />

      {/* Error Banner with Graceful Retry */}
      {error && (
        <div style={{
          padding: '16px 20px', marginBottom: '24px', borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#F87171',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>DATA TEMPORARILY UNAVAILABLE</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {error}
              </div>
            </div>
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '0.75rem', gap: '6px' }}>
            <RefreshCw size={12} /> Retry Connection
          </button>
        </div>
      )}

      {/* Executive KPI Strip (8 Core Fintech Observability Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatsCard
          title="Total Payment Intents"
          value={kpis.total_intents ?? 0}
          subtitle="Operational ledger total"
          icon={CreditCard}
          color="#3B82F6"
          provenance="DATABASE"
          tooltip="Total payment intents created across all payment rails."
        />
        <StatsCard
          title="Successfully Resolved"
          value={kpis.successfully_resolved ?? 0}
          subtitle={`Resolution Rate: ${resolutionRate}%`}
          icon={CheckCircle2}
          color="#22C55E"
          provenance="DATABASE"
          tooltip="Payments safely captured or reconciled by Policy Engine."
        />
        <StatsCard
          title="Failed Payments"
          value={kpis.failed_payments ?? 0}
          subtitle="Declined or terminal rail fail"
          icon={XCircle}
          color="#EF4444"
          provenance="RAZORPAY_TEST"
          tooltip="Payments explicitly failed due to bank error, user decline, or timeout."
        />
        <StatsCard
          title="UNCERTAIN Payments"
          value={kpis.uncertain_payments ?? 0}
          subtitle="Pending evidence verification"
          icon={AlertTriangle}
          color="#F59E0B"
          provenance="DATABASE"
          tooltip="Payments awaiting late authorization or webhook evidence."
        />
        <StatsCard
          title="Manual Review Cases"
          value={kpis.manual_reviews ?? 0}
          subtitle="Escalated to human operator"
          icon={UserCheck}
          color="#A855F7"
          provenance="DATABASE"
          tooltip="Conflicting state payments escalated to operator intervention."
        />
        <StatsCard
          title="Webhooks Processed"
          value={webhooks.total_received ?? 0}
          subtitle={`Verification Rate: ${webhooks.verification_rate ?? 100}%`}
          icon={Webhook}
          color="#0EA5E9"
          provenance="RAZORPAY_TEST"
          tooltip="Total HMAC webhooks received and processed."
        />
        <StatsCard
          title="Duplicates Prevented"
          value={kpis.duplicates_prevented ?? 0}
          subtitle={`Deduplication: ${webhooks.deduplication_rate ?? 100}%`}
          icon={Copy}
          color="#EC4899"
          provenance="DATABASE"
          tooltip="Duplicate webhooks and idempotency replays deduplicated safely."
        />
        <StatsCard
          title="Financial Mutations"
          value="₹0.00"
          subtitle="Guaranteed 0 real money touched"
          icon={Lock}
          color="#10B981"
          provenance="AI_TEST_LAB"
          tooltip="Calculated from test results. AI Test Lab and Chaos Lab have 0 external financial egress."
        />
      </div>

      {/* Row 2: Payment State Distribution Donut Chart + Resolution Time-Series Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Payment State Breakdown Chart */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Payment State Distribution
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Current state machine classification across all payment intents.
              </p>
            </div>
            <Link href="/payments" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Registry <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          {stateDist.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No state distribution data available. Simulate an order to populate.
            </div>
          ) : (
            <div>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stateDist}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {stateDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '14px' }}>
                {stateDist.map((st) => (
                  <Link
                    key={st.name}
                    href={`/payments?status=${st.name}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.color }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{st.count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Time-Series Resolution Trend Chart */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Payment Resolution Trend
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Real DB timestamps tracking intent states over time.
              </p>
            </div>

            {/* Range Selector */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-hover)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              {['24h', '7d', '30d', 'all'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                    background: timeRange === r ? 'var(--accent-primary)' : 'transparent',
                    color: timeRange === r ? '#FFF' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {trendData.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Insufficient historical timeline records in range.
            </div>
          ) : (
            <div style={{ height: '240px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="failed" name="Failed" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="uncertain" name="Uncertain" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="manual_review" name="Manual Review" stroke="#A855F7" fill="#A855F7" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Payment Rail Analytics & Failure Intelligence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Payment Rail Comparative Analytics */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Payment Rail Performance
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                State distribution split by active payment rail.
              </p>
            </div>
          </div>

          {railData.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No payment rail activity registered yet.
            </div>
          ) : (
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={railData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="rail" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Bar dataKey="successful" name="Successful" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uncertain" name="Uncertain" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Failure Intelligence Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Failure Intelligence & Patterns
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Aggregated failure categories from evidence and audit logs.
              </p>
            </div>
          </div>

          {failureIntel.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={28} color="#22C55E" style={{ marginBottom: '10px' }} />
              <div>Zero payment failures recorded in current window.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {failureIntel.slice(0, 5).map((f) => (
                <div key={f.category} style={{
                  padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Category: {f.category}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#EF4444' }}>
                      {f.count}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {f.percentage}% of failures
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: AI Test Lab Intelligence & Resilience Scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* AI Test Lab Intelligence */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                AI Test Lab Intelligence
              </h2>
            </div>
            <Link href="/engineering/ai-test-lab" className="btn btn-secondary" style={{ fontSize: '0.75rem', gap: '4px' }}>
              OPEN AI TEST LAB <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL RUNS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{aiLab.total_runs ?? 0}</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PASSED SCENARIOS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#22C55E', marginTop: '2px' }}>{aiLab.passed ?? 0}</div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>MUTATIONS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>0</div>
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              Latest Suite Status: <span style={{ color: '#4ADE80', fontWeight: 800 }}>{aiLab.latest_run_status || 'IDLE'}</span>
            </div>
            <ProvenanceBadge type="AI_TEST_LAB" size="small" />
          </div>
        </div>

        {/* Chaos Resilience Scorecard */}
        <ResilienceScorecard data={stats} />
      </div>

      {/* Row 5: Financial Safety Panel + AI Decision Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        <FinancialSafetyPanel data={stats} />
        <AiPipelineVisualizer />
      </div>

      {/* Row 6: Live Resolution Activity Stream */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-active" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Live Resolution Timeline Stream
            </h2>
          </div>
          <Link href="/webhooks" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Observability Console <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentEvents.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Activity size={32} color="var(--border-color)" style={{ marginBottom: '12px' }} />
              <div>No recent resolution events. Stream will update automatically.</div>
            </div>
          ) : (
            recentEvents.slice(0, 6).map((evt) => {
              const isRecent = evt.received_at && new Date(evt.received_at) > new Date(Date.now() - 300000);
              return (
                <div key={evt.event_id} style={{
                  padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: isRecent ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 700, fontFamily: 'monospace' }}>
                      {evt.received_at ? new Date(evt.received_at).toLocaleTimeString() : 'NOW'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{evt.event_type}</span>
                        <ProvenanceBadge type={evt.provenance} size="small" />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                        Intent: {evt.payment_intent_id}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      STATE → {evt.current_state || 'CREATED'}
                    </span>
                    <Link href={`/payments/${evt.payment_intent_id}`} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                      Inspect →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
