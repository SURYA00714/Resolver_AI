'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import {
  Settings, Plug, Sun, Moon, Eye, RotateCcw, Shield, AlertTriangle,
  CheckCircle2, XCircle, Activity, Database, Cpu, CreditCard, Sliders,
  Lock, Key, RefreshCw, LayoutDashboard, Terminal, Info, Check, ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [resetting, setResetting] = useState(false);
  const [judgeMode, setJudgeMode] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Dashboard widget customization state
  const [widgets, setWidgets] = useState({
    showResilienceBanner: true,
    showKpis: true,
    showCharts: true,
    showRecentActivity: true,
    showRecentPayments: true,
  });

  useEffect(() => {
    // Load judge mode
    const storedJudge = localStorage.getItem('resolverai_judge_mode');
    if (storedJudge === 'true') setJudgeMode(true);

    // Load widget preferences
    const storedWidgets = localStorage.getItem('resolverai_dashboard_widgets');
    if (storedWidgets) {
      try {
        setWidgets(JSON.parse(storedWidgets));
      } catch (e) {
        // Fall back to default
      }
    }

    // Load health
    api.getIntegrationHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  const handleWidgetToggle = (key) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem('resolverai_dashboard_widgets', JSON.stringify(updated));
    showFeedback('Dashboard widget configuration saved');
  };

  const handleJudgeToggle = () => {
    const nextVal = !judgeMode;
    setJudgeMode(nextVal);
    localStorage.setItem('resolverai_judge_mode', nextVal ? 'true' : 'false');
    showFeedback(nextVal ? 'Judge Mode enabled' : 'Judge Mode disabled');
  };

  const showFeedback = (msg) => {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleReset = async () => {
    if (!confirm('Reset synthetic demo data? Real Razorpay test data remains intact.')) return;
    setResetting(true);
    try {
      await api.resetDemoEnvironment();
      alert('Synthetic demo data reset successfully.');
    } catch (err) {
      alert(`Reset notice: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const StatusIcon = ({ ok }) => ok
    ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
    : <XCircle size={16} style={{ color: 'var(--color-danger)' }} />;

  const tabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'ai', label: 'AI Engine', icon: Cpu },
    { id: 'payments', label: 'Payments & Rails', icon: CreditCard },
    { id: 'security', label: 'Security & Proof', icon: Lock },
    { id: 'dashboard', label: 'Dashboard Control', icon: LayoutDashboard },
    { id: 'presentation', label: 'Demo & Presentation', icon: Eye },
    { id: 'developer', label: 'Developer & Labs', icon: Terminal },
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>System Settings & Control Center</h1>
        <p className="page-subtitle" style={{ marginTop: '4px' }}>
          Configure environment preferences, integration health, AI guardrails, and dashboard widgets
        </p>
      </div>

      {/* Save Feedback Banner */}
      {saveFeedback && (
        <div style={{
          padding: '10px 16px', marginBottom: '20px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--color-success)',
          color: 'var(--color-success)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <Check size={16} /> {saveFeedback}
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* GENERAL */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>Appearance & Theme</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Select your interface color scheme. Both modes are calibrated for high legibility and contrast.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Interface Theme</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Currently active: <strong style={{ textTransform: 'capitalize' }}>{theme}</strong>
                </div>
              </div>
              <button onClick={toggleTheme} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>System Environment</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Current runtime target and execution containment.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXECUTION MODE</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>Razorpay Test Mode</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FINANCIAL MUTATION LIMIT</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>₹0.00 (Hard Cap)</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MULTI-TENANT SCOPE</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>merchant_default</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Infrastructure & Upstream Services</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Live connectivity status for backend microservices</div>
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  api.getIntegrationHealth()
                    .then(setHealth)
                    .catch(() => setHealth(null))
                    .finally(() => setLoading(false));
                }}
                className="btn btn-secondary btn-sm"
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Check Now
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card" />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Razorpay API', key: 'razorpay', icon: CreditCard, desc: 'Payment provider connection (Key ID configured)' },
                  { label: 'PostgreSQL Database', key: 'database', icon: Database, desc: 'Primary transactional ledger and outbox persistence' },
                  { label: 'Redis Cache & Outbox', key: 'redis', icon: Activity, desc: 'Distributed lock manager & idempotency cache (In-memory fallback active if offline)' },
                  { label: 'AI Detective Engine', key: 'ai', icon: Cpu, desc: 'Diagnostic reasoning advisory engine (Non-blocking)' },
                ].map(svc => {
                  const status = health ? (health[svc.key] || health[svc.key + '_connected']) : false;
                  const isOk = status === true || status === 'connected' || status === 'healthy';
                  return (
                    <div key={svc.key} style={{
                      padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', gap: '14px',
                    }}>
                      <StatusIcon ok={isOk} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{svc.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{svc.desc}</div>
                      </div>
                      <span className={`badge ${isOk ? 'badge-success' : 'badge-neutral'}`}>
                        {isOk ? 'Operational' : 'Degraded Fallback Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <Link href="/settings/integration" className="btn btn-secondary btn-sm">
              <Plug size={14} /> Open Detailed Diagnostics View
            </Link>
          </div>
        </div>
      )}

      {/* AI ENGINE */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>AI Detective & Advisory Model</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              ResolverAI uses AI strictly for advisory hypothesis generation. AI never executes financial mutations directly.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INTELLIGENCE LAYER</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>Hybrid Diagnostic Agent</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Fallback to rule-based pattern matching if external LLM API is unavailable.
                </div>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GOVERNANCE PROTOCOL</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>Deterministic Policy Engine</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  100% of mutations require cryptographically signed capability tokens.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS & RAILS */}
      {activeTab === 'payments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>Payment Rail Configuration</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Settings governing Razorpay Test Mode communication, webhook processing, and reconciliation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Webhook Signature Verification</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HMAC-SHA256 verification using Razorpay webhook secret</div>
                </div>
                <span className="badge badge-success">Enforced</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>3-Way Reconciliation Strategy</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authoritative provider truth polling vs internal ledger state</div>
                </div>
                <span className="badge badge-info">Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Paise Minor-Unit Math</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Strict integer money conversion via domain/money.py</div>
                </div>
                <span className="badge badge-success">Enforced</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>Cryptographic & Identity Controls</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Security guarantees enforced across API, state transitions, and audit records.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ShieldCheck size={16} color="var(--color-success)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Capability Tokens</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Financial mutations require constant-time signed <code>AuthorizedAction</code> tokens with 60-second validity.
                </p>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Key size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Tenant Isolation</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Multi-tenant isolation enforced via composite database indexes on <code>(merchant_id, payment_intent_id)</code>.
                </p>
              </div>
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Lock size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>SHA-256 Audit Trail</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  Every transition generates an immutable, tamper-evident hash record in the append-only ledger.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD CONTROL */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px' }}>Dashboard Widget Visibility</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Customize which cards and modules are rendered on the primary dashboard. Changes save immediately.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'showResilienceBanner', title: 'System Resilience Banner', desc: 'Displays real-time deterministic governance status' },
                { key: 'showKpis', title: 'Executive KPI Metrics', desc: 'Total intents, success rate, auto-healed, and webhooks' },
                { key: 'showCharts', title: 'State Distribution Chart', desc: 'Graphical breakdown of payment intent lifecycle states' },
                { key: 'showRecentActivity', title: 'Recent System Activity', desc: 'Live event stream of incoming payment webhooks' },
                { key: 'showRecentPayments', title: 'Recent Payment Intents Table', desc: 'Authoritative transaction ledger with quick inspect links' },
              ].map(w => (
                <div key={w.key} style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{w.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.desc}</div>
                  </div>
                  <button
                    onClick={() => handleWidgetToggle(w.key)}
                    className={`btn btn-sm ${widgets[w.key] ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {widgets[w.key] ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DEMO / PRESENTATION */}
      {activeTab === 'presentation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} /> Judge Mode Configuration
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Enables contextual evaluation helpers for Razorpay AI Buildathon reviewers without cluttering the primary operational UI.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Judge Evaluation Mode</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Displays scenario verification indicators and quick testing shortcuts across the platform
                </div>
              </div>
              <button
                onClick={handleJudgeToggle}
                className={`btn btn-sm ${judgeMode ? 'btn-primary' : 'btn-secondary'}`}
              >
                {judgeMode ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={16} /> Synthetic Demo Data Reset
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Clears synthetic test runs and injected chaos scenarios. Authoritative Razorpay transactions are unaffected.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Reset Synthetic Environment</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe zero-money operation</div>
              </div>
              <button onClick={handleReset} className="btn btn-danger btn-sm" disabled={resetting}>
                <RotateCcw size={14} className={resetting ? 'spin' : ''} />
                {resetting ? 'Resetting...' : 'Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER */}
      {activeTab === 'developer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} /> Developer Test Harnesses & Labs
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Adversarial simulation tools for verifying policy resilience and edge-case resolution.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/engineering/ai-test-lab" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
                <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>AI Test Lab</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Run 8 full buildathon payment scenarios with bounded polling</div>
                </div>
              </Link>
              <Link href="/engineering/testing" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px 16px' }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Chaos & Edge-Case Injection Lab</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inject delayed webhooks, duplicate signatures, and dropped events</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
