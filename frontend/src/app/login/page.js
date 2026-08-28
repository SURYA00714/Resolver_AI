'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { ShieldCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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
        if (me && me.authenticated) {
          router.replace('/');
        }
      } catch (err) {
        // Silently catch session check failure on initial page load
      }
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
        if (typeof api.setToken === 'function') {
          api.setToken(res.access_token);
        } else if (typeof setToken === 'function') {
          setToken(res.access_token);
        }
        router.replace('/');
      } else {
        throw new Error('Authentication succeeded but no access token was returned.');
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A0D12 0%, #121824 50%, #1A2332 100%)',
      padding: '24px',
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #2AB673 0%, #15693F 100%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(42, 182, 115, 0.3)', marginBottom: '12px',
          }}>
            <ShieldCheck size={24} color="#FFF" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFF', margin: 0 }}>ResolverAI</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>Payment Integrity Control Plane</p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px', marginBottom: '20px', borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex', alignItems: 'center', gap: '8px', color: '#F87171', fontSize: '0.85rem',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', background: '#0A0F1A',
                border: '1px solid #1E2535', borderRadius: '8px', color: '#E2E8F0', fontSize: '0.9rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 40px 10px 14px', background: '#0A0F1A',
                  border: '1px solid #1E2535', borderRadius: '8px', color: '#E2E8F0', fontSize: '0.9rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: '#0A0F1A',
                border: '1px solid #1E2535', borderRadius: '8px', color: '#E2E8F0', fontSize: '0.9rem',
              }}
            >
              <option value="viewer">Viewer — Read-only</option>
              <option value="operator">Operator — Reconcile & Resolve</option>
              <option value="admin">Admin — Full Access</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
