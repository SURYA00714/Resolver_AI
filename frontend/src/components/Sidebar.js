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
  Settings,
  Plug,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  FlaskConical,
} from 'lucide-react';
import { api } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'read:dashboard' },
  { href: '/payments', label: 'Payments', icon: CreditCard, permission: 'read:payments' },
  { href: '/payments/new', label: 'Create Order', icon: PlusCircle, permission: 'write:create_order' },
  { href: '/cases', label: 'Recon Cases', icon: AlertTriangle, permission: 'read:cases' },
  { href: '/webhooks', label: 'Webhook History', icon: Webhook, permission: 'read:webhooks' },
  { href: '/audit', label: 'Audit Trail', icon: FileText, permission: 'read:audit' },
  { href: '/settings/integration', label: 'Integration', icon: Plug, permission: 'read:integration' },
];

const engineeringItems = [
  { href: '/engineering/testing', label: 'Chaos Lab', icon: FlaskConical },
];

export default function Sidebar() {
  const pathname = usePathname();
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

  const razorpayMode = health?.razorpay_mode;
  const isSynthetic = razorpayMode === 'SYNTHETIC' || !razorpayMode;
  const statusColor = health?.status === 'ok' ? '#2AB673' : '#F87171';
  const statusLabel = health?.status === 'ok' ? 'Backend Connected' : 'Backend Unreachable';

  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  const visibleNav = user?.authenticated
    ? navItems.filter(item => (user.permissions || []).includes(item.permission))
    : [];

  return (
    <aside style={{
      width: '260px',
      background: '#0A0F1A',
      borderRight: '1px solid #1E2535',
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
      <div style={{ flex: 1 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 24px 8px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #2AB673 0%, #15693F 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 18px rgba(42, 182, 115, 0.3)', flexShrink: 0,
          }}>
            <ShieldCheck size={20} color="#FFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em', margin: 0 }}>
              Resolver<span style={{ color: '#2AB673' }}>AI</span>
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 500, margin: 0 }}>
              Payment Integrity Platform
            </p>
          </div>
        </div>

        {/* Razorpay Mode Banner */}
        {isSynthetic && (
          <div style={{
            margin: '0 0 16px 0', padding: '8px 12px',
            background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)',
            borderRadius: '8px', fontSize: '0.72rem', color: '#FBBF24', fontWeight: 500,
          }}>
            ⚠ TEST MODE — No real Razorpay API
          </div>
        )}

        {/* Navigation */}
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
                  fontWeight: isActive ? 600 : 400, color: isActive ? '#2AB673' : '#94A3B8',
                  background: isActive ? 'rgba(42, 182, 115, 0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #2AB673' : '3px solid transparent',
                  textDecoration: 'none', transition: 'all 0.15s ease',
                }}
              >
                <Icon size={17} color={isActive ? '#2AB673' : '#475569'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Engineering section (collapsed by default) */}
        {user?.authenticated && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowEngineering(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 13px', background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', fontSize: '0.75rem', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}
            >
              <span>Engineering</span>
              {showEngineering ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showEngineering && engineeringItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '11px',
                  padding: '8px 13px 8px 20px', borderRadius: '8px', fontSize: '0.83rem',
                  fontWeight: isActive ? 600 : 400, color: isActive ? '#FB923C' : '#64748B',
                  background: isActive ? 'rgba(251, 146, 60, 0.08)' : 'transparent',
                  textDecoration: 'none',
                }}>
                  <Icon size={16} color={isActive ? '#FB923C' : '#475569'} />
                  <span>{item.label}</span>
                  <span style={{ fontSize: '0.65rem', background: '#1E2535', color: '#64748B', padding: '2px 5px', borderRadius: '4px', marginLeft: 'auto' }}>
                    LOCAL
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* System Status Footer */}
      <div style={{
        padding: '12px 14px', background: '#0E1826', border: '1px solid #1E2535',
        borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#E2E8F0' }}>
            {statusLabel}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#475569' }}>
            {health ? `Razorpay: ${razorpayMode || 'NOT_SET'}` : 'Checking...'}
          </div>
        </div>
        {user?.authenticated ? (
          <button onClick={handleLogout} title="Sign out" style={{
            background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px',
          }}>
            <LogOut size={16} />
          </button>
        ) : (
          <Link href="/login" title="Sign in" style={{ color: '#64748B', display: 'inline-flex' }}>
            <User size={16} />
          </Link>
        )}
      </div>
    </aside>
  );
}
