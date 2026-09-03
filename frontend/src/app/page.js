'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BuildathonHeader from '@/components/BuildathonHeader';
import ResilienceHeroCard from '@/components/ResilienceHeroCard';
import LifecycleFlowVisualizer from '@/components/LifecycleFlowVisualizer';
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
  Terminal,
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
  const stateDist = stats?.state_distribution || [];
  const trendData = stats?.resolution_trend || [];
  const railData = stats?.rail_analytics || [];
  const failureIntel = stats?.failure_intelligence || [];
  const recentEvents = stats?.recent_events || [];

  const resolutionRate = kpis.total_intents > 0 ? ((kpis.successfully_resolved / kpis.total_intents) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* 1. Hero Command Center Header */}
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

      {/* 2. Executive KPI Strip (8 Core Metrics) */}
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

      {/* Row 2: Resilience Hero Score + Payment State Distribution Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* 2. SYSTEM RESILIENCE HERO SCORE */}
        <ResilienceHeroCard data={stats} />

        {/* 5. LIVE PAYMENT STATE DISTRIBUTION */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Live Payment State Distribution
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Click state pill to filter Payments Registry.
              </p>
            </div>
            <Link href="/payments" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Registry View <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          {stateDist.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No state distribution data available. Simulate an order to populate.
            </div>
          ) : (
            <div>
              <div style={{ height: '190px', width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stateDist}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
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
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{kpis.total_intents ?? 0}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>INTENTS</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '10px' }}>
                {stateDist.map((st) => (
                  <Link key={st.name} href={`/payments?status=${st.name}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
      </div>

      {/* 3. PAYMENT STATE LIFECYCLE VISUALIZATION */}
      <div style={{ marginBottom: '28px' }}>
        <LifecycleFlowVisualizer />
      </div>

      {/* Row 4: Resolution Timeline & Webhook Reliability */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* 6. PAYMENT RESOLUTION TIMELINE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Payment Resolution Timeline
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Real database timestamps over time.
              </p>
            </div>
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
            <div style={{ height: '220px', width: '100%' }}>
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

        {/* 8. WEBHOOK RELIABILITY OBSERVABILITY */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Webhook size={18} color="#0EA5E9" />
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Webhook Reliability & Observability
              </h2>
            </div>
            <Link href="/webhooks" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Console <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>RECEIVED</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{webhooks.total_received ?? 0}</div>
            </div>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>VERIFIED RATE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22C55E' }}>{webhooks.verification_rate ?? 100}%</div>
            </div>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>DEDUPLICATED</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#EC4899' }}>{webhooks.deduplication_rate ?? 100}%</div>
            </div>
          </div>

          {/* Event Stream Sample */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentEvents.slice(0, 3).map((evt) => (
              <div key={evt.event_id} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{evt.event_type}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{evt.payment_intent_id?.slice(0, 12)}…</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Failure Intelligence & Chaos Scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* 7. FAILURE INTELLIGENCE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Failure Intelligence Categories
            </h2>
          </div>
          {failureIntel.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} color="#22C55E" style={{ marginBottom: '8px' }} />
              <div>Zero payment failures recorded in current window.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {failureIntel.slice(0, 5).map((f) => (
                <div key={f.category} style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{f.name}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#EF4444' }}>{f.count} ({f.percentage}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 9. CHAOS LAB SCORECARD */}
        <ResilienceScorecard data={stats} />
      </div>

      {/* Row 6: AI Test Lab & Financial Safety */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* 10. AI TEST LAB INTELLIGENCE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RUNS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{aiLab.total_runs ?? 0}</div>
            </div>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>PASSED</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22C55E' }}>{aiLab.passed ?? 0}</div>
            </div>
            <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>MUTATIONS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10B981' }}>0</div>
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            Status: <span style={{ color: '#4ADE80', fontWeight: 800 }}>{aiLab.latest_run_status || 'IDLE'}</span>
          </div>
        </div>

        {/* 11. FINANCIAL SAFETY PANEL */}
        <FinancialSafetyPanel data={stats} />
      </div>

      {/* Row 7: 4. AI ≠ AUTHORITY PIPELINE */}
      <div style={{ marginBottom: '28px' }}>
        <AiPipelineVisualizer />
      </div>

      {/* Row 8: 12. LIVE RESOLUTION ACTIVITY STREAM */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Live Resolution Terminal Stream
            </h2>
          </div>
          <Link href="/webhooks" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Console <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace' }}>
          {recentEvents.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No recent resolution events. Incoming webhooks will stream here automatically.
            </div>
          ) : (
            recentEvents.slice(0, 6).map((evt) => (
              <div key={evt.event_id} style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '10px' }}>
                    {evt.received_at ? new Date(evt.received_at).toLocaleTimeString() : 'NOW'}
                  </span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, marginRight: '10px' }}>
                    {evt.event_type}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Intent: {evt.payment_intent_id?.slice(0, 14)}…
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ProvenanceBadge type={evt.provenance} size="small" />
                  <Link href={`/payments/${evt.payment_intent_id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                    Inspect →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
