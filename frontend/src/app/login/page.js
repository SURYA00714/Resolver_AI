'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { ShieldCheck, AlertTriangle, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('operator');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const me = await api.getAuthMe();
        if (me && me.authenticated) { router.replace('/'); }
      } catch (err) { /* initial check */ }
    };
    check();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(username, password, role);
      if (res && res.access_token) {
        if (typeof api.setToken === 'function') { api.setToken(res.access_token); }
        else if (typeof setToken === 'function') { setToken(res.access_token); }
        router.replace('/');
      } else {
        throw new Error('Authentication succeeded but no access token was returned.');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg-primary)',
    }}>
      {/* Left: Branding Panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 56px',
        background: 'linear-gradient(160deg, #1E3A5F 0%, #0B1120 60%, #111827 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        <div style={{ position: 'relative', maxWidth: '440px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: '#3B82F6', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={22} color="#FFF" />
            </div>
            <span style={{ fontSize: '1.375rem', fontWeight: 700, color: '#F1F5F9' }}>
              Resolver<span style={{ color: '#3B82F6' }}>AI</span>
            </span>
          </div>

          <h2 style={{
            fontSize: '2rem', fontWeight: 700, color: '#F1F5F9',
            lineHeight: 1.25, marginBottom: '16px', letterSpacing: '-0.02em',
          }}>
            Autonomous Payment<br/>Integrity Platform
          </h2>

          <p style={{ fontSize: '0.9375rem', color: '#94A3B8', lineHeight: 1.6, marginBottom: '36px' }}>
            Real-time reconciliation, deterministic policy enforcement, and AI-assisted dispute resolution for Razorpay merchants.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'HMAC-verified webhook ingestion', desc: 'Cryptographic proof of every provider event' },
              { label: 'Deterministic policy engine', desc: 'Financial safety with capped autonomy' },
              { label: 'Immutable audit trail', desc: 'SHA-256 sealed evidence chain' },
            ].map((feat, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6',
                  marginTop: '7px', flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#E2E8F0' }}>{feat.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Card */}
      <div style={{
        width: '480px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: '360px', width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Sign in
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '28px' }}>
            Access your payment operations dashboard
          </p>

          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: '20px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
              display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)',
              fontSize: '0.8125rem',
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Username
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                required autoFocus className="input" placeholder="Enter username"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required
                  className="input" placeholder="Enter password"
                  style={{ paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    padding: '2px', display: 'flex',
                  }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Role
              </label>
              <select value={role} onChange={e => setRole(e.target.value)} className="input">
                <option value="viewer">Viewer — Read-only</option>
                <option value="operator">Operator — Reconcile & Resolve</option>
                <option value="admin">Admin — Full Access</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', padding: '10px', marginTop: '4px', fontSize: '0.875rem' }}>
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{
            marginTop: '28px', padding: '12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center',
          }}>
            Razorpay Test Mode · No real money is processed
          </div>
        </div>
      </div>
    </div>
  );
}
