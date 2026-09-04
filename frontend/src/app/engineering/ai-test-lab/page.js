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
        return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC', text: 'COMPLETED' };
      case 'FAILED':
        return { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5', text: 'FAILED' };
      case 'TIMED_OUT':
        return { bg: '#FFEDD5', color: '#C2410C', border: '#FDBA74', text: 'TIMED OUT' };
      case 'STOPPED':
        return { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', text: 'STOPPED' };
      case 'RUNNING':
      default:
        return { bg: '#FEF3C7', color: '#B45309', border: '#FDE047', text: statusStr || 'RUNNING' };
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
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Top Operational Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '16px', padding: '20px 24px', background: '#FFFFFF',
          borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}>
              <Cpu size={22} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  RESOLVER<span style={{ color: '#2563EB' }}>AI</span> TEST LAB
                </h1>
                <span style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase',
                }}>
                  v2.4 Engine
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: '#64748B', margin: '2px 0 0 0', fontWeight: 500 }}>
                Autonomous adversarial payment state verification, chaos injection, and deterministic policy testing
              </p>
            </div>
          </div>

          {/* Operational Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <ShieldCheck size={14} /> ISOLATED ENVIRONMENT
            </span>

            <span style={{
              background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Zap size={14} /> NO REAL MONEY (₹0.00)
            </span>

            <span style={{
              background: executing || demoExecuting ? '#FEE2E2' : '#F1F5F9',
              border: `1px solid ${executing || demoExecuting ? '#FCA5A5' : '#CBD5E1'}`,
              color: executing || demoExecuting ? '#B91C1C' : '#475569',
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: executing || demoExecuting ? '#EF4444' : '#2563EB',
              }} />
              RUNNER: {executing || demoExecuting ? 'EXECUTING...' : 'IDLE'}
            </span>

            <button
              onClick={loadLabData}
              style={{
                background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569',
                padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px',
            padding: '12px 16px', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>⚠ {errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* Feature Banner: Judges Buildathon Demo Runner */}
        <div style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderRadius: '12px', padding: '20px 24px', color: '#FFFFFF',
          border: '1px solid #334155', boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px',
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
              style={{
                background: '#2563EB', border: '1px solid #3B82F6', color: '#FFFFFF',
                padding: '10px 20px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 800,
                cursor: demoExecuting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
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
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Total Scenarios Executed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
              {totals.total_scenarios || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
              Across {totals.total_runs || 0} test runs
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Deterministic Oracle Passed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16A34A' }}>
              {totals.total_passed || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
              State assertion verified
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              State Violations Detected
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#DC2626' }}>
              {totals.total_failed || 0}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
              Critical discrepancies
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Concurrency Guard
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              1 (Sequential Locked)
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
              Race-condition safe
            </div>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
              Timeout Protection
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
              60s Strict Policy
            </div>
            <div style={{ fontSize: '0.72rem', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>
              Auto-terminates hung runs
            </div>
          </div>
        </div>

        {/* Filter Bar & Runner Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '12px', background: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: '10px', padding: '12px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#64748B" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Filter Scenario Suite:</span>
            {['ALL', 'DEMO', 'FAILURE', 'TIMEOUT', 'ADVERSARIAL'].map((suite) => (
              <button
                key={suite}
                onClick={() => setSelectedSuiteFilter(suite)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                  border: selectedSuiteFilter === suite ? '1px solid #2563EB' : '1px solid #CBD5E1',
                  background: selectedSuiteFilter === suite ? '#2563EB' : '#F8FAFC',
                  color: selectedSuiteFilter === suite ? '#FFFFFF' : '#475569',
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
              style={{
                background: '#EA580C', border: '1px solid #C2410C', color: '#FFFFFF',
                padding: '7px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                cursor: executing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Zap size={14} /> Run Adversarial Suite (10x)
            </button>
            <button
              onClick={handleGenerateAiScenarios}
              disabled={generating}
              style={{
                background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#334155',
                padding: '7px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <Sparkles size={14} color="#2563EB" />
              {generating ? 'Generating...' : 'Synthesize Scenarios'}
            </button>
          </div>
        </div>

        {/* Main 2-Column Operational Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '20px' }}>
          
          {/* Left Column: Scenario Library & Trigger List */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#2563EB" /> Scenario Test Catalog ({filteredScenarios.length})
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>Deterministic Oracles Ready</span>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '520px', paddingRight: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F1F5F9', textAlign: 'left', color: '#64748B', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 4px' }}>Scenario</th>
                    <th style={{ padding: '8px 4px' }}>Risk</th>
                    <th style={{ padding: '8px 4px' }}>Expected State</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScenarios.map((scen) => (
                    <tr key={scen.scenario_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{scen.title}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>{scen.scenario_type}</div>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{
                          fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                          background: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? '#FEE2E2' : '#EFF6FF',
                          color: scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? '#B91C1C' : '#1D4ED8',
                          border: `1px solid ${scen.risk_level === 'CRITICAL' || scen.risk_level === 'HIGH' ? '#FCA5A5' : '#BFDBFE'}`,
                        }}>
                          {scen.risk_level}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#334155', fontWeight: 700, fontFamily: 'monospace' }}>
                          {scen.expected_state}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRunSingleScenario(scen.scenario_type)}
                          disabled={executing}
                          style={{
                            background: '#2563EB', border: 'none', color: '#FFFFFF',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}
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
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                      INSPECTING RUN RESULT
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0 0', color: '#0F172A' }}>
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
                          border: selectedResult?.result_id === r.result_id ? '2px solid #2563EB' : '1px solid #E2E8F0',
                          background: r.status === 'PASS' ? '#DCFCE7' : '#FEE2E2',
                          color: r.status === 'PASS' ? '#15803D' : '#B91C1C',
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
                      background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
                      border: '1px solid #E2E8F0',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A' }}>
                          {selectedResult.scenario_type}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                          {selectedResult.scenario_id}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                        background: selectedResult.status === 'PASS' ? '#DCFCE7' : '#FEE2E2',
                        color: selectedResult.status === 'PASS' ? '#15803D' : '#B91C1C',
                        border: `1px solid ${selectedResult.status === 'PASS' ? '#86EFAC' : '#FCA5A5'}`,
                      }}>
                        ORACLE: {selectedResult.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: '6px' }}>
                          EXPECTED ASSERTION
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A', marginBottom: '3px' }}>
                          State: <strong style={{ fontFamily: 'monospace' }}>{selectedResult.expected_result.expected_state}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A', marginBottom: '3px' }}>
                          HTTP: <strong style={{ fontFamily: 'monospace' }}>{selectedResult.expected_result.expected_http_status}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A' }}>
                          Idempotent: <strong>{String(selectedResult.expected_result.expected_idempotent)}</strong>
                        </div>
                      </div>

                      <div style={{
                        background: selectedResult.status === 'PASS' ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${selectedResult.status === 'PASS' ? '#BBF7D0' : '#FECACA'}`,
                        borderRadius: '8px', padding: '12px',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: selectedResult.status === 'PASS' ? '#15803D' : '#B91C1C', textTransform: 'uppercase', marginBottom: '6px' }}>
                          OBSERVED ACTUAL
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A', marginBottom: '3px' }}>
                          State: <strong style={{ fontFamily: 'monospace' }}>{selectedResult.actual_result.actual_state}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A', marginBottom: '3px' }}>
                          HTTP: <strong style={{ fontFamily: 'monospace' }}>{selectedResult.actual_result.actual_http_status}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A' }}>
                          Idempotent: <strong>{String(selectedResult.actual_result.actual_idempotent)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* AI Advisory Box */}
                    {selectedResult.ai_analysis && (
                      <div style={{
                        background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563EB', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Cpu size={14} /> AI Advisory Explanation
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: 700, marginBottom: '3px' }}>
                          Hypothesis: {selectedResult.ai_analysis.hypothesis}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                          {selectedResult.ai_analysis.recommended_investigation}
                        </div>
                      </div>
                    )}

                    {/* Monospaced Execution Log Terminal Box */}
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Terminal size={13} /> Monospaced Execution Trace
                      </div>
                      <div style={{
                        background: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px', padding: '12px',
                        fontSize: '0.72rem', fontFamily: 'JetBrains Mono, monospace', color: '#94A3B8',
                        maxHeight: '180px', overflowY: 'auto',
                      }}>
                        {selectedResult.trace?.map((step) => (
                          <div key={step.step_number} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
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
                background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '32px',
                textAlign: 'center', color: '#64748B',
              }}>
                <Activity size={32} style={{ marginBottom: '8px', color: '#94A3B8' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No active test run selected.</div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '4px' }}>Click RUN BUILDATHON DEMO above to start evaluation.</div>
              </div>
            )}

            {/* Historical Runs Summary Table */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#2563EB" /> Historical Test Runs
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F1F5F9', textAlign: 'left', color: '#64748B', fontSize: '0.72rem' }}>
                      <th style={{ padding: '6px 4px' }}>Run ID</th>
                      <th style={{ padding: '6px 4px' }}>Type</th>
                      <th style={{ padding: '6px 4px' }}>Status</th>
                      <th style={{ padding: '6px 4px' }}>Score</th>
                      <th style={{ padding: '6px 4px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.run_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                          #{r.run_id.substring(0, 8)}
                        </td>
                        <td style={{ padding: '8px 4px', color: '#475569' }}>{r.run_type}</td>
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
                        <td style={{ padding: '8px 4px', color: '#16A34A', fontWeight: 700 }}>
                          {r.scenarios_passed} / {r.scenarios_total}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <button
                            onClick={() => loadRunDetails(r.run_id)}
                            style={{
                              background: 'none', border: 'none', color: '#2563EB',
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
            background: 'rgba(15, 23, 42, 0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              background: '#FFFFFF', border: '1px solid #CBD5E1',
              borderRadius: '12px', padding: '24px', maxWidth: '460px', width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0F172A' }}>
                Confirm Adversarial Suite Execution
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
                You are initiating 10 isolated payment state failure scenarios. All tests operate on synthetic intents in sandbox mode with zero live financial impact.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569',
                    padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunAdversarialSuite}
                  style={{
                    background: '#EA580C', border: 'none', color: '#FFFFFF',
                    padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
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
