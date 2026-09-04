'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Webhook,
  PlusCircle,
  Plug,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  FlaskConical,
  Sun,
  Moon,
  Activity,
  Cpu,
  Sparkles,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';

const mainNav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, permission: 'read:dashboard' },
  { href: '/payments', label: 'Payments Registry', icon: CreditCard, permission: 'read:payments' },
  { href: '/payments/new', label: 'Create Order & Pay', icon: PlusCircle, permission: 'write:create_order' },
  { href: '/cases', label: 'Recon Cases', icon: AlertTriangle, permission: 'read:cases' },
];

const operationsNav = [
  { href: '/webhooks', label: 'Webhook History', icon: Webhook, permission: 'read:webhooks' },
  { href: '/audit', label: 'Audit Trail', icon: FileText, permission: 'read:audit' },
  { href: '/settings/integration', label: 'Integration Health', icon: Plug, permission: 'read:integration' },
];

const engineeringItems = [
  { href: '/engineering/ai-test-lab', label: 'AI Test Lab', icon: ShieldCheck },
  { href: '/engineering/testing', label: 'Chaos Lab', icon: FlaskConical },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [showEngineering, setShowEngineering] = useState(true);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => setHealth({ status: 'error' }));
    api.getAuthMe().then(setUser).catch(() => setUser(null));
    const interval = setInterval(() => {
      api.getHealth().then(setHealth).catch(() => setHealth({ status: 'error' }));
      api.getAuthMe().then(setUser).catch(() => setUser(null));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const razorpayMode = health?.razorpay_mode || 'TEST';
  const statusColor = health?.status === 'ok' ? '#10B981' : '#EF4444';
  const statusLabel = health?.status === 'ok' ? 'System Operational' : 'Engine Offline';

  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  const filterNav = (items) => {
    return user?.authenticated
      ? items.filter(item => (user.permissions || []).includes(item.permission))
      : items;
  };

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px 14px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 18px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--card-shadow)', flexShrink: 0,
            }}>
              <ShieldCheck size={20} color="#FFF" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Resolver<span style={{ color: 'var(--accent-primary)' }}>AI</span>
              </h1>
              <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Payment Intelligence
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={14} color="#FBBF24" /> : <Moon size={14} color="#2563EB" />}
          </button>
        </div>

        {/* Sandbox Environment Pill */}
        <div style={{
          margin: '14px 0', padding: '8px 12px',
          background: 'var(--badge-sim-bg)', border: '1px solid var(--badge-sim-border)',
          borderRadius: '6px', fontSize: '0.72rem', color: 'var(--badge-sim-text)', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B' }} />
            SANDBOX MODE
          </span>
          <span style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#B45309', fontWeight: 800 }}>
            ₹0 REAL MONEY
          </span>
        </div>

        {/* Main Navigation */}
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 6px 6px 6px' }}>
          Payment Operations
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filterNav(mainNav).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Compliance & Audit Navigation */}
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 6px 6px 6px' }}>
          Observability & Audit
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filterNav(operationsNav).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '6px', fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Engineering Lab Section */}
        <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setShowEngineering(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 6px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >
            <span>AI & Chaos Studio</span>
            {showEngineering ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showEngineering && engineeringItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 12px 7px 16px', borderRadius: '6px', fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                textDecoration: 'none',
              }}>
                <Icon size={15} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer System Status */}
      <div style={{
        padding: '10px 12px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {statusLabel}
          </div>
          <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
            {user?.user?.username ? `Role: ${user.user.role}` : 'Operator Mode'}
          </div>
        </div>
        {user?.authenticated ? (
          <button onClick={handleLogout} title="Sign out" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
          }}>
            <LogOut size={15} />
          </button>
        ) : (
          <Link href="/login" title="Sign in" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
            <User size={15} />
          </Link>
        )}
      </div>
    </aside>
  );
}
