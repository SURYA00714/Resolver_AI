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
  Filter,
  ChevronDown,
  Terminal,
  Shield,
  Check,
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
  const [selectedSuiteFilter, setSelectedSuiteFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [demoExecuting, setDemoExecuting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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
        return { bg: 'var(--color-success-bg)', color: 'var(--color-success)', border: 'var(--color-success-border)', text: 'COMPLETED' };
      case 'FAILED':
        return { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'var(--color-danger-border)', text: 'FAILED' };
      case 'TIMED_OUT':
        return { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: 'var(--color-warning-border)', text: 'TIMED OUT' };
      case 'STOPPED':
        return { bg: 'var(--bg-surface-hover)', color: 'var(--text-muted)', border: 'var(--border-color)', text: 'STOPPED' };
      case 'RUNNING':
      default:
        return { bg: 'var(--color-info-bg)', color: 'var(--color-info)', border: 'var(--color-info-border)', text: statusStr || 'RUNNING' };
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
      await api.generateAiScenarios({ count: 5 });
      await loadLabData();
    } catch (err) {
      setErrorMsg(err.message || 'Scenario generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const totals = status?.totals || {};
  const latestRun = activeRun?.run || status?.latest_run;

  const filteredScenarios = scenarios.filter(scen => {
    if (selectedSuiteFilter === 'ALL') return true;
    if (selectedSuiteFilter === 'DEMO') return ['delayed_webhook', 'duplicate_webhook', 'tampered_signature'].includes(scen.scenario_type);
    if (selectedSuiteFilter === 'FAILURE') return ['payment_failed', 'bank_downtime', 'impossible_jump'].includes(scen.scenario_type);
    if (selectedSuiteFilter === 'TIMEOUT') return ['authorized_timeout', 'webhook_timeout'].includes(scen.scenario_type);
    if (selectedSuiteFilter === 'ADVERSARIAL') return scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH';
    return true;
  });

  return (
    <AuthGuard>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
        
        {/* Top Operational Header */}
        <div className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px', padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'var(--brand-primary, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}>
              <Cpu size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  RESOLVER<span style={{ color: 'var(--accent-primary)' }}>AI</span> TEST LAB
                </h1>
                <span style={{
                  background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', color: 'var(--color-info)',
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase',
                }}>
                  v2.4 Engine
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
                Autonomous adversarial payment state verification, chaos injection, and deterministic policy testing
              </p>
            </div>
          </div>

          {/* Operational Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', color: 'var(--color-success)',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <ShieldCheck size={14} /> ISOLATED ENVIRONMENT
            </span>

            <span style={{
              background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', color: 'var(--color-info)',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Zap size={14} /> NO REAL MONEY (₹0.00)
            </span>

            <span style={{
              background: executing || demoExecuting ? 'var(--color-danger-bg)' : 'var(--bg-surface-hover)',
              border: `1px solid ${executing || demoExecuting ? 'var(--color-danger-border)' : 'var(--border-color)'}`,
              color: executing || demoExecuting ? 'var(--color-danger)' : 'var(--text-secondary)',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: executing || demoExecuting ? 'var(--color-danger)' : 'var(--accent-primary)',
              }} />
              RUNNER: {executing || demoExecuting ? 'EXECUTING...' : 'IDLE'}
            </span>

            <button
              onClick={loadLabData}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', fontWeight: 600 }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: '8px',
            padding: '12px 16px', color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>⚠ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* Feature Banner: Judges Buildathon Demo Runner */}
        <div style={{
          background: 'linear-gradient(135deg, #111827 0%, #172033 100%)',
          borderRadius: '12px', padding: '20px 24px', color: '#FFFFFF',
          border: '1px solid var(--border-color)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={18} color="#F59E0B" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                BUILDATHON EVALUATION SUITE
              </span>
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0', color: '#F8FAFC' }}>
              Execute 8-Scenario Adversarial Failure Matrix
            </h2>
            <p style={{ fontSize: '0.83rem', color: '#94A3B8', margin: 0, maxWidth: '750px' }}>
              Tests duplicate webhooks, tampered HMAC signatures, late captures, state machine conflict rejections, and bank downtime handling in single-click isolation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={triggerBuildathonDemo}
              disabled={demoExecuting || executing}
              className="btn btn-primary"
              style={{
                padding: '10px 20px', fontSize: '0.875rem', fontWeight: 800,
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
              }}
            >
              {demoExecuting ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
              {demoExecuting ? 'RUNNING 8 SCENARIOS...' : 'RUN BUILDATHON DEMO'}
            </button>
          </div>
        </div>

        {/* Operational Metrics Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Scenarios Executed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {totals.total_scenarios || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across {totals.total_runs || 0} test runs
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Deterministic Oracle Passed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-success)' }}>
              {totals.total_passed || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              State assertion verified
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              State Violations Detected
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-danger)' }}>
              {totals.total_failed || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Critical discrepancies
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-warning)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Concurrency Guard
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              1 (Sequential Locked)
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Race-condition safe
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Timeout Protection
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              60s Strict Policy
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', marginTop: '4px', fontWeight: 600 }}>
              Auto-terminates hung runs
            </div>
          </div>
        </div>

        {/* Filter Bar & Runner Controls */}
        <div className="card" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px', padding: '12px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Filter Scenario Suite:</span>
            {['ALL', 'DEMO', 'FAILURE', 'TIMEOUT', 'ADVERSARIAL'].map((suite) => (
              <button
                key={suite}
                onClick={() => setSelectedSuiteFilter(suite)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                  border: selectedSuiteFilter === suite ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: selectedSuiteFilter === suite ? 'var(--accent-primary)' : 'var(--bg-surface-hover)',
                  color: selectedSuiteFilter === suite ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {suite}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={executing}
              className="btn btn-sm"
              style={{
                background: '#EA580C', borderColor: '#C2410C', color: '#FFFFFF',
                fontWeight: 700,
              }}
            >
              <Zap size={14} /> Run Adversarial Suite (10x)
            </button>
            <button
              onClick={handleGenerateAiScenarios}
              disabled={generating}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 600 }}
            >
              <Sparkles size={14} color="var(--accent-primary)" />
              {generating ? 'Generating...' : 'Synthesize Scenarios'}
            </button>
          </div>
        </div>

        {/* Main 2-Column Operational Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '20px' }}>
          
          {/* Left Column: Scenario Library & Trigger List */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="var(--accent-primary)" /> Scenario Test Catalog ({filteredScenarios.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Deterministic Oracles Ready</span>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '520px', paddingRight: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 4px' }}>Scenario</th>
                    <th style={{ padding: '8px 4px' }}>Risk</th>
                    <th style={{ padding: '8px 4px' }}>Expected State</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScenarios.map((scen) => (
                    <tr key={scen.scenario_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{scen.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{scen.scenario_type}</div>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{
                          fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                          background: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? 'var(--color-danger-bg)' : 'var(--color-info-bg)',
                          color: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? 'var(--color-danger)' : 'var(--color-info)',
                          border: `1px solid ${scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? 'var(--color-danger-border)' : 'var(--color-info-border)'}`,
                        }}>
                          {scen.risk_level}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'monospace' }}>
                          {scen.expected_state}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRunSingleScenario(scen.scenario_type)}
                          disabled={executing}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                        >
                          <Play size={10} /> RUN
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Active Run Inspection & Monospaced Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Active Run Overview Card */}
            {latestRun ? (
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      INSPECTING RUN RESULT
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                      Run #{latestRun.run_id ? latestRun.run_id.substring(0, 8) : 'demo'} ({latestRun.run_type})
                    </h3>
                  </div>

                  <div>
                    {(() => {
                      const b = getStatusBadge(latestRun.status);
                      return (
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                          background: b.bg, color: b.color, border: `1px solid ${b.border}`,
                        }}>
                          {b.text}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Scenario Pills Selector */}
                {activeRun?.results?.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
                    {activeRun.results.map((r, i) => (
                      <button
                        key={r.result_id}
                        onClick={() => setSelectedResult(r)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                          border: selectedResult?.result_id === r.result_id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          background: r.status === 'PASS' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                          color: r.status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        #{i+1} {r.scenario_type}
                      </button>
                    ))}
                  </div>
                )}

                {/* Expected vs Actual Grid */}
                {selectedResult && (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-surface-hover)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
                      border: '1px solid var(--border-color)',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {selectedResult.scenario_type}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {selectedResult.scenario_id}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                        background: selectedResult.status === 'PASS' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                        color: selectedResult.status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)',
                        border: `1px solid ${selectedResult.status === 'PASS' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                      }}>
                        {selectedResult.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                      <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expected Verification</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '3px' }}>State: <strong>{selectedResult.expected?.state}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '3px' }}>Action: <strong>{selectedResult.expected?.action}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>Anomaly: <strong>{selectedResult.expected?.anomaly || 'None'}</strong></div>
                      </div>

                      <div style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual System State</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '3px' }}>State: <strong>{selectedResult.actual?.state}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '3px' }}>Action: <strong>{selectedResult.actual?.action}</strong></div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>Policy: <strong>{selectedResult.actual?.policy_rule || 'Matched'}</strong></div>
                      </div>
                    </div>

                    {/* AI Explanation Box */}
                    {selectedResult.ai_analysis && (
                      <div style={{
                        background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)', borderRadius: '8px',
                        padding: '12px 14px', marginBottom: '16px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Cpu size={14} /> AI Advisory Explanation
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '3px' }}>
                          Hypothesis: {selectedResult.ai_analysis.hypothesis}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {selectedResult.ai_analysis.recommended_investigation}
                        </div>
                      </div>
                    )}

                    {/* Monospaced Execution Log Terminal Box */}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={13} /> Monospaced Execution Trace
                      </div>
                      <div style={{
                        background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px',
                        fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)',
                        maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {selectedResult.trace?.map((step) => (
                          <div key={step.step_number} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                            <span style={{ color: 'var(--text-muted)' }}>[{step.timestamp}]</span>{' '}
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{step.phase}</span>:{' '}
                            <span style={{ color: 'var(--text-primary)' }}>{step.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{
                padding: '32px', textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <Activity size={32} style={{ marginBottom: '8px', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No active test run selected.</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Click RUN BUILDATHON DEMO above to start evaluation.</div>
              </div>
            )}

            {/* Historical Runs Summary Table */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--accent-primary)" /> Historical Test Runs
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                      <th style={{ padding: '6px 4px' }}>Run ID</th>
                      <th style={{ padding: '6px 4px' }}>Type</th>
                      <th style={{ padding: '6px 4px' }}>Status</th>
                      <th style={{ padding: '6px 4px' }}>Score</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.run_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          #{r.run_id.substring(0, 8)}
                        </td>
                        <td style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{r.run_type}</td>
                        <td style={{ padding: '8px 4px' }}>
                          {(() => {
                            const b = getStatusBadge(r.status);
                            return (
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.68rem',
                                background: b.bg, color: b.color, border: `1px solid ${b.border}`,
                              }}>
                                {b.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '8px 4px', color: 'var(--color-success)', fontWeight: 700 }}>
                          {r.scenarios_passed} / {r.scenarios_total}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <button
                            onClick={() => loadRunDetails(r.run_id)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--accent-primary)',
                              fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem',
                            }}
                          >
                            Select
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

        {/* Modal Confirmation for Adversarial Run */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}>
            <div className="card" style={{
              padding: '24px', maxWidth: '460px', width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                Confirm Adversarial Suite Execution
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                You are initiating 10 isolated payment state failure scenarios. All tests operate on synthetic intents in sandbox mode with zero live financial impact.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunAdversarialSuite}
                  className="btn btn-sm"
                  style={{
                    background: '#EA580C', borderColor: '#C2410C', color: '#FFFFFF',
                    fontWeight: 800,
                  }}
                >
                  Run 10 Scenarios
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  );
}
