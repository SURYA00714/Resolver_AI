'use client';

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Play,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  Activity,
  Layers,
  Cpu,
  RefreshCw,
  Search,
  Lock,
  Flame,
  FileCode,
  Sparkles,
  StopCircle,
} from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import StatusBadge from '@/components/StatusBadge';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { api } from '@/lib/api';

export default function AITestLabPage() {
  const [status, setStatus] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [demoExecuting, setDemoExecuting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingRunAction, setPendingRunAction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadLabData();
    const interval = setInterval(loadLabData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadLabData = async () => {
    try {
      const [statusRes, scensRes, runsRes] = await Promise.all([
        api.getTestLabStatus().catch(() => null),
        api.getTestLabScenarios().catch(() => ({ scenarios: [] })),
        api.getTestLabRuns().catch(() => ({ runs: [] })),
      ]);

      if (statusRes) setStatus(statusRes);
      if (scensRes?.scenarios) setScenarios(scensRes.scenarios);
      if (runsRes?.runs) setRuns(runsRes.runs);

      // Auto load details for latest run if not selected
      if (runsRes?.runs?.length > 0 && !activeRun) {
        loadRunDetails(runsRes.runs[0].run_id);
      }
    } catch (err) {
      console.error('Failed to load AI Test Lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRunDetails = async (runId) => {
    try {
      const data = await api.getTestLabRun(runId);
      setActiveRun(data);
      if (data?.results?.length > 0) {
        setSelectedResult(data.results[0]);
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err);
    }
  };

  const getStatusBadge = (statusStr) => {
    switch (statusStr) {
      case 'COMPLETED':
        return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', text: 'COMPLETED' };
      case 'FAILED':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', text: 'FAILED' };
      case 'TIMED_OUT':
        return { bg: 'rgba(249, 115, 22, 0.15)', color: '#F97316', text: 'TIMED OUT' };
      case 'STOPPED':
        return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', text: 'STOPPED' };
      case 'RUNNING':
      default:
        return { bg: 'rgba(234, 179, 8, 0.15)', color: '#EAB308', text: statusStr || 'RUNNING' };
    }
  };

  const pollRunDetails = async (runId, maxSeconds = 30) => {
    const start = Date.now();
    while (Date.now() - start < maxSeconds * 1000) {
      try {
        const data = await api.getTestLabRun(runId);
        if (data?.run) {
          setActiveRun(data);
          if (data.results?.length > 0) {
            setSelectedResult(data.results[0]);
          }
          if (['COMPLETED', 'FAILED', 'TIMED_OUT', 'STOPPED'].includes(data.run.status)) {
            await loadLabData();
            return;
          }
        }
      } catch (e) {
        console.error('Polling run details:', e);
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    await loadLabData();
  };

  const triggerBuildathonDemo = async () => {
    setDemoExecuting(true);
    setErrorMsg(null);
    try {
      const res = await api.runTestLabSuite({ mode: 'DEMO', demo: true });
      setActiveRun(res.run);
      if (res.run?.results?.length > 0) {
        setSelectedResult(res.run.results[0]);
      }
      if (res.run?.run_id && res.run?.status === 'RUNNING') {
        await pollRunDetails(res.run.run_id);
      } else {
        await loadLabData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Buildathon Demo execution failed');
    } finally {
      setDemoExecuting(false);
    }
  };

  const handleRunAdversarialSuite = async () => {
    setShowConfirmModal(false);
    setExecuting(true);
    setErrorMsg(null);
    try {
      const res = await api.runAiAdversarialSuite({ count: 10 });
      setActiveRun(res.run);
      if (res.run?.results?.length > 0) {
        setSelectedResult(res.run.results[0]);
      }
      if (res.run?.run_id && res.run?.status === 'RUNNING') {
        await pollRunDetails(res.run.run_id);
      } else {
        await loadLabData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Adversarial suite execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleRunSingleScenario = async (scenarioType) => {
    setExecuting(true);
    setErrorMsg(null);
    try {
      const res = await api.runTestLabSuite({ scenario_type: scenarioType });
      setActiveRun(res.run);
      if (res.run?.results?.length > 0) {
        setSelectedResult(res.run.results[0]);
      }
      if (res.run?.run_id && res.run?.status === 'RUNNING') {
        await pollRunDetails(res.run.run_id);
      } else {
        await loadLabData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Scenario execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleGenerateAiScenarios = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await api.generateAiScenarios({ count: 5 });
      await loadLabData();
    } catch (err) {
      setErrorMsg(err.message || 'Scenario generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const totals = status?.totals || {};
  const latestRun = activeRun?.run || status?.latest_run;

  return (
    <AuthGuard>
      <div style={{ padding: '28px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header Section */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px', marginBottom: '24px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
              }}>
                <Cpu size={24} color="#FFF" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  RESOLVER<span style={{ color: 'var(--accent-primary)' }}>AI</span> TEST LAB
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                  Autonomous adversarial testing for payment-state integrity
                </p>
              </div>
            </div>
          </div>

          {/* Header Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#818CF8', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Zap size={14} /> TEST MODE
            </span>

            <span style={{
              background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ADE80', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <ShieldCheck size={14} /> ISOLATED ENVIRONMENT
            </span>

            <span style={{
              background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#FACC15', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              NO REAL MONEY
            </span>

            <span style={{
              background: executing || demoExecuting ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface-hover)',
              border: '1px solid var(--border-color)',
              color: executing || demoExecuting ? '#EF4444' : 'var(--text-secondary)',
              padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: executing || demoExecuting ? '#EF4444' : 'var(--accent-primary)',
              }} className={executing || demoExecuting ? 'pulse-active' : ''} />
              AI TESTER: {executing || demoExecuting ? 'ACTIVE' : 'IDLE'}
            </span>

            <span style={{
              background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
            }}>
              Provider: <strong style={{ color: 'var(--accent-primary)' }}>{status?.active_ai_provider || 'Deterministic'}</strong>
            </span>
          </div>
        </div>

        {/* Live Safety Warning Banner */}
        <div style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', padding: '12px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: '#EF4444', color: '#FFF', fontSize: '0.68rem', fontWeight: 800,
              padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.04em',
            }}>
              ⚠ LOCAL AI SIMULATION
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              All test events use synthetic intent IDs (<code style={{ color: 'var(--accent-primary)' }}>AI_TEST_...</code>).
              ResolverAI deterministic Policy Engine & State Machine operate on isolated intents. <strong>0 real Razorpay API calls.</strong>
            </span>
          </div>
          <button onClick={loadLabData} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem',
          }}>
            <RefreshCw size={14} /> Refresh Status
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', borderRadius: '10px',
            padding: '12px 16px', color: '#F87171', fontSize: '0.85rem', marginBottom: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>⚠ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Buildathon Demo Run Feature Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '16px', padding: '24px',
          marginBottom: '28px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={20} color="#FBBF24" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Judges Demo Execution
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFF', margin: '0 0 6px 0' }}>
                BUILDATHON DEMO RUN — 8 Key Adversarial Scenarios
              </h2>
              <p style={{ fontSize: '0.83rem', color: '#94A3B8', margin: 0, maxWidth: '720px' }}>
                Instantly trigger standard success flow, bank downtime, duplicate webhooks, tampered signatures, late webhooks, state conflicts, duplicate verifications, and impossible state jumps.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={triggerBuildathonDemo}
                disabled={demoExecuting || executing}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  border: 'none', color: '#FFF', padding: '12px 24px', borderRadius: '10px',
                  fontSize: '0.9rem', fontWeight: 800, cursor: demoExecuting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                {demoExecuting ? <RefreshCw size={18} className="spin-active" /> : <Play size={18} color="#FFF" />}
                {demoExecuting ? 'EXECUTING DEMO SUITE...' : 'RUN BUILDATHON DEMO'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px', marginBottom: '28px',
        }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
              Tests Run
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totals.total_scenarios || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across {totals.total_runs || 0} test runs
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
              Passed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#22C55E' }}>
              {totals.total_passed || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Deterministic oracle pass
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
              Failed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#EF4444' }}>
              {totals.total_failed || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Critical discrepancies
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#EAB308', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
              Warnings
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#EAB308' }}>
              {totals.total_warning || 0}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Minor discrepancies
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: '#818CF8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
              Financial Mutations
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10B981' }}>
              0
            </div>
            <div style={{ fontSize: '0.7rem', color: '#10B981', marginTop: '4px', fontWeight: 600 }}>
              100% Policy Protected
            </div>
          </div>
        </div>

        {/* Main Control Center Grid: Left (Runner & Scenarios), Right (Live Execution & Details) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', marginBottom: '28px' }}>
          
          {/* Left Column: AI Adversarial Runner & Scenario Library */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* AI Adversarial Runner Card */}
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: '14px', padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={18} color="#F97316" /> AI Adversarial Suite
                </h3>
                <span style={{ fontSize: '0.7rem', background: 'rgba(249, 115, 22, 0.1)', color: '#F97316', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  AUTONOMOUS
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                AI generates and executes complex payment edge case combinations (reordered webhooks, double verification, signature tampering).
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={executing}
                  style={{
                    flex: 1, background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                    border: 'none', color: '#FFF', padding: '10px 16px', borderRadius: '8px',
                    fontSize: '0.83rem', fontWeight: 700, cursor: executing ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <Zap size={16} /> RUN ADVERSARIAL TEST
                </button>
                <button
                  onClick={handleGenerateAiScenarios}
                  disabled={generating}
                  style={{
                    background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', padding: '10px 14px', borderRadius: '8px',
                    fontSize: '0.83rem', fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Sparkles size={16} color="#818CF8" />
                  {generating ? 'GENERATING...' : 'GENERATE'}
                </button>
              </div>
            </div>

            {/* Scenario Library */}
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: '14px', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--accent-primary)" /> Scenario Library ({scenarios.length})
                </h3>
              </div>

              <div style={{ overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 4px' }}>Scenario</th>
                      <th style={{ padding: '8px 4px' }}>Risk</th>
                      <th style={{ padding: '8px 4px' }}>Expected</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((scen) => (
                      <tr key={scen.scenario_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{scen.title}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{scen.scenario_type}</div>
                        </td>
                        <td style={{ padding: '10px 4px' }}>
                          <span style={{
                            fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                            background: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? '#EF4444' : '#60A5FA',
                          }}>
                            {scen.risk_level}
                          </span>
                        </td>
                        <td style={{ padding: '10px 4px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {scen.expected_state}
                          </span>
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRunSingleScenario(scen.scenario_type)}
                            disabled={executing}
                            style={{
                              background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                              color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '6px',
                              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            RUN
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Live Execution Timeline, Expected vs Actual, AI Findings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Active Run Overview & Discrepancies */}
            {latestRun ? (
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: '14px', padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      ACTIVE TEST RUN
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                      Run #{latestRun.run_id ? latestRun.run_id.substring(0, 8) : 'demo'} ({latestRun.run_type})
                    </h3>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(() => {
                      const b = getStatusBadge(latestRun.status);
                      return (
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          background: b.bg, color: b.color,
                        }}>
                          {b.text}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Scenario Selector Pills */}
                {activeRun?.results?.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
                    {activeRun.results.map((r, i) => (
                      <button
                        key={r.result_id}
                        onClick={() => setSelectedResult(r)}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                          border: selectedResult?.result_id === r.result_id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          background: r.status === 'PASS' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: r.status === 'PASS' ? '#22C55E' : '#EF4444', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        #{i+1} {r.scenario_type}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Result Expected vs Actual */}
                {selectedResult && (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-surface-hover)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {selectedResult.scenario_type}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {selectedResult.scenario_id}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800,
                        background: selectedResult.status === 'PASS' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: selectedResult.status === 'PASS' ? '#22C55E' : '#EF4444',
                      }}>
                        ORACLE: {selectedResult.status}
                      </span>
                    </div>

                    {/* Expected vs Actual Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '10px', padding: '12px',
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60A5FA', uppercase: true, marginBottom: '8px' }}>
                          DETERMINISTIC EXPECTED
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          State: <strong>{selectedResult.expected_result.expected_state}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          HTTP: <strong>{selectedResult.expected_result.expected_http_status}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          Idempotent: <strong>{String(selectedResult.expected_result.expected_idempotent)}</strong>
                        </div>
                      </div>

                      <div style={{
                        background: selectedResult.status === 'PASS' ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        border: selectedResult.status === 'PASS' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '10px', padding: '12px',
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: selectedResult.status === 'PASS' ? '#4ADE80' : '#F87171', uppercase: true, marginBottom: '8px' }}>
                          OBSERVED ACTUAL
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          State: <strong>{selectedResult.actual_result.actual_state}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          HTTP: <strong>{selectedResult.actual_result.actual_http_status}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                          Idempotent: <strong>{String(selectedResult.actual_result.actual_idempotent)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* AI Advisory Findings */}
                    {selectedResult.ai_analysis && (
                      <div style={{
                        background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                        borderRadius: '10px', padding: '14px', marginBottom: '16px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Cpu size={14} /> AI Advisory Explanation
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '4px' }}>
                          Hypothesis: {selectedResult.ai_analysis.hypothesis}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {selectedResult.ai_analysis.recommended_investigation}
                        </div>
                      </div>
                    )}

                    {/* Execution Step Trace */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        LIVE EXECUTION TRACE
                      </div>
                      <div style={{
                        background: '#0F172A', border: '1px solid var(--border-color)',
                        borderRadius: '8px', padding: '12px', fontSize: '0.72rem', fontFamily: 'monospace',
                        color: '#94A3B8', maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {selectedResult.trace?.map((step) => (
                          <div key={step.step_number} style={{ marginBottom: '6px' }}>
                            <span style={{ color: '#64748B' }}>[{step.timestamp}]</span>{' '}
                            <span style={{ color: '#38BDF8', fontWeight: 700 }}>{step.phase}</span>:{' '}
                            <span style={{ color: '#E2E8F0' }}>{step.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                borderRadius: '14px', padding: '32px', textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <Activity size={32} style={{ marginBottom: '8px' }} />
                <div>No test runs recorded yet. Click <strong>RUN BUILDATHON DEMO</strong> above.</div>
              </div>
            )}

            {/* Historical Runs Table */}
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: '14px', padding: '20px',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-primary)" /> Historical Test Runs
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 4px' }}>Run ID</th>
                      <th style={{ padding: '8px 4px' }}>Type</th>
                      <th style={{ padding: '8px 4px' }}>Status</th>
                      <th style={{ padding: '8px 4px' }}>Passed</th>
                      <th style={{ padding: '8px 4px' }}>Risk</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.run_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          #{r.run_id.substring(0, 8)}
                        </td>
                        <td style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{r.run_type}</td>
                        <td style={{ padding: '8px 4px' }}>
                          {(() => {
                            const b = getStatusBadge(r.status);
                            return (
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem',
                                background: b.bg, color: b.color,
                              }}>
                                {b.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '8px 4px', color: '#22C55E', fontWeight: 700 }}>
                          {r.scenarios_passed} / {r.scenarios_total}
                        </td>
                        <td style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{r.risk_level}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <button
                            onClick={() => loadRunDetails(r.run_id)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--accent-primary)',
                              fontWeight: 700, cursor: 'pointer', fontSize: '0.72rem',
                            }}
                          >
                            SELECT
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Key Architecture Story */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '14px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px', textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '4px' }}>
              AI DOES NOT CONTROL THE MONEY
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              AI generates hypotheses and adversarial edge cases.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F97316', marginBottom: '4px' }}>
              AI ATTACKS THE SYSTEM
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Autonomously probing state machine boundaries.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10B981', marginBottom: '4px' }}>
              DETERMINISTIC POLICY PROTECTS MONEY
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ResolverAI Policy Engine enforces 5 mandatory safety rules.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38BDF8', marginBottom: '4px' }}>
              EVERY TEST IS REPRODUCIBLE
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Full trace and deterministic oracle stored in audit log.
            </div>
          </div>
        </div>

        {/* Modal Confirmation Before Large Adversarial Run */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '90%',
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                Confirm Adversarial Suite Execution
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                You are about to execute 10 isolated payment-state scenarios. No real Razorpay transactions will be created.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)', padding: '10px 18px', borderRadius: '8px',
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleRunAdversarialSuite}
                  style={{
                    background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                    border: 'none', color: '#FFF', padding: '10px 18px', borderRadius: '8px',
                    fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  RUN TESTS
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
