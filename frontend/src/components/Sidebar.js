'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, CreditCard, AlertTriangle, FileText, ShieldCheck, Webhook,
  PlusCircle, Plug, ChevronDown, ChevronRight, LogOut, User, FlaskConical,
  Sun, Moon, Settings, Search, Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';

const mainNav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'read:dashboard' },
  { href: '/payments', label: 'Payments', icon: CreditCard, permission: 'read:payments' },
  { href: '/payments/new', label: 'Create Order', icon: PlusCircle, permission: 'write:create_order' },
  { href: '/cases', label: 'Cases', icon: AlertTriangle, permission: 'read:cases' },
];

const observabilityNav = [
  { href: '/webhooks', label: 'Webhooks', icon: Webhook, permission: 'read:webhooks' },
  { href: '/audit', label: 'Audit Trail', icon: FileText, permission: 'read:audit' },
];

const systemNav = [
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'read:integration' },
];

const engineeringItems = [
  { href: '/engineering/ai-test-lab', label: 'AI Test Lab', icon: ShieldCheck },
  { href: '/engineering/testing', label: 'Chaos Lab', icon: FlaskConical },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [showEngineering, setShowEngineering] = useState(false);

  useEffect(() => {
    if (pathname === '/login') return;
    api.getAuthMe().then(setUser).catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = () => {
    api.clearToken();
    window.location.href = '/login';
  };

  if (pathname === '/login') return null;

  const filterNav = (items) => {
    if (!user?.permissions) return items;
    return items.filter(item => !item.permission || user.permissions.includes(item.permission));
  };

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    return (
      <Link href={item.href} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-light)' : 'transparent',
        transition: 'background 0.1s ease, color 0.1s ease',
      }}>
        <Icon size={16} style={{ opacity: isActive ? 1 : 0.65 }} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const NavGroup = ({ label, items }) => (
    <>
      <div style={{
        fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        padding: '16px 12px 6px 12px',
      }}>{label}</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '0 4px' }}>
        {filterNav(items).map(item => <NavItem key={item.href} item={item} />)}
      </nav>
    </>
  );

  return (
    <aside style={{
      width: 'var(--sidebar-width)', height: '100vh', position: 'sticky', top: 0,
      background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px 12px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheck size={18} color="#FFF" />
            </div>
            <div>
              <h1 style={{
                fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: '-0.01em', margin: 0,
              }}>
                Resolver<span style={{ color: 'var(--accent-primary)' }}>AI</span>
              </h1>
              <p style={{
                fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0,
              }}>
                Payment Intelligence
              </p>
            </div>
          </div>
          <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            style={{
              background: 'none', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)',
              padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        {/* Environment Pill */}
        <div style={{ padding: '0 12px', marginBottom: '8px' }}>
          <div className="env-pill" style={{ width: '100%', justifyContent: 'center' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-warning)' }} />
            TEST MODE · ₹0 REAL MONEY
          </div>
        </div>

        {/* Search hint */}
        <div style={{ padding: '0 12px 4px 12px' }}>
          <button onClick={() => {
            const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
            document.dispatchEvent(e);
          }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface-hover)', border: '1px solid var(--border-color)',
            color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer',
          }}>
            <Search size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
            <span style={{
              fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            }}>⌘K</span>
          </button>
        </div>

        {/* Navigation Groups */}
        <NavGroup label="Operations" items={mainNav} />
        <NavGroup label="Observability" items={observabilityNav} />
        <NavGroup label="System" items={systemNav} />

        {/* Engineering (Collapsible) */}
        <div style={{ padding: '12px 12px 0 12px' }}>
          <button onClick={() => setShowEngineering(v => !v)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '0.625rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <span>Engineering</span>
            {showEngineering ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
        {showEngineering && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 4px 0 4px' }}>
            {engineeringItems.map(item => <NavItem key={item.href} item={item} />)}
          </nav>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 10px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-surface-hover)',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--accent-light)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <User size={14} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.user?.username || 'Operator'}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              {user?.user?.role || 'operator'}
            </div>
          </div>
          {user?.authenticated ? (
            <button onClick={handleLogout} title="Sign out" style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px', display: 'flex',
            }}>
              <LogOut size={14} />
            </button>
          ) : (
            <Link href="/login" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <LogOut size={14} />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
