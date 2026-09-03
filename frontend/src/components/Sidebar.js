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
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'read:dashboard' },
  { href: '/payments', label: 'Payments Registry', icon: CreditCard, permission: 'read:payments' },
  { href: '/payments/new', label: 'Create Order & Pay', icon: PlusCircle, permission: 'write:create_order' },
  { href: '/cases', label: 'Recon Cases', icon: AlertTriangle, permission: 'read:cases' },
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
  const [showEngineering, setShowEngineering] = useState(false);

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
  const statusColor = health?.status === 'ok' ? 'var(--accent-primary)' : '#EF4444';
  const statusLabel = health?.status === 'ok' ? 'Engine Connected' : 'Engine Offline';

  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  const visibleNav = user?.authenticated
    ? navItems.filter(item => (user.permissions || []).includes(item.permission))
    : navItems; // show default list preview if unauthenticated for rendering fallback

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      gap: '0',
    }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #15693F 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px var(--accent-glow)', flexShrink: 0,
            }}>
              <ShieldCheck size={20} color="#FFF" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Resolver<span style={{ color: 'var(--accent-primary)' }}>AI</span>
              </h1>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Fintech Integrity
              </p>
            </div>
          </div>

          {/* Theme Toggle Switcher */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? <Sun size={15} color="#FBBF24" /> : <Moon size={15} color="#6366F1" />}
          </button>
        </div>

        {/* Live Environment Badge */}
        <div style={{
          margin: '0 0 16px 0', padding: '6px 12px',
          background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
          borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-active" />
            RAZORPAY MODE
          </span>
          <span style={{
            fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px',
            background: razorpayMode === 'LIVE' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            color: razorpayMode === 'LIVE' ? '#22C55E' : '#60A5FA', fontWeight: 700,
          }}>
            {razorpayMode}
          </span>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px',
                  padding: '9px 13px', borderRadius: '8px', fontSize: '0.855rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  textDecoration: 'none', transition: 'all 0.15s ease',
                }}
              >
                <Icon size={17} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Engineering Section */}
        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setShowEngineering(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 13px', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >
            <span>Engineering Lab</span>
            {showEngineering ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showEngineering && engineeringItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '11px',
                padding: '8px 13px 8px 20px', borderRadius: '8px', fontSize: '0.83rem',
                fontWeight: isActive ? 700 : 500, color: isActive ? '#FB923C' : 'var(--text-muted)',
                background: isActive ? 'rgba(251, 146, 60, 0.1)' : 'transparent',
                textDecoration: 'none',
              }}>
                <Icon size={16} color={isActive ? '#FB923C' : 'var(--text-muted)'} />
                <span>{item.label}</span>
                <span style={{ fontSize: '0.62rem', background: 'var(--badge-sim-bg)', color: 'var(--badge-sim-text)', padding: '2px 5px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 700 }}>
                  SIM
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Status Footer */}
      <div style={{
        padding: '12px 14px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
        borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {statusLabel}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {user?.user?.username ? `Role: ${user.user.role}` : 'Operator Interface'}
          </div>
        </div>
        {user?.authenticated ? (
          <button onClick={handleLogout} title="Sign out" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
          }}>
            <LogOut size={16} />
          </button>
        ) : (
          <Link href="/login" title="Sign in" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
            <User size={16} />
          </Link>
        )}
      </div>
    </aside>
  );
}
