'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CreditCard, 
  AlertTriangle, 
  Flame, 
  FileText, 
  ShieldCheck,
  Activity
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/cases', label: 'Recon Cases', icon: AlertTriangle },
  { href: '/chaos-lab', label: 'Chaos Lab', icon: Flame },
  { href: '/audit', label: 'Audit Trail', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: '260px',
      background: '#0E131F',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      justify: 'space-between',
      padding: '24px 16px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 28px 8px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2AB673 0%, #15693F 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px var(--accent-glow)',
          }}>
            <ShieldCheck size={22} color="#FFF" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', letterSpacing: '-0.02em' }}>
              Resolver<span style={{ color: '#2AB673' }}>AI</span>
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Razorpay Integrity Plane
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#2AB673' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(42, 182, 115, 0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #2AB673' : '3px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} color={isActive ? '#2AB673' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div className="pulse-active" />
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Policy Engine Active
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Razorpay Test Mode
          </div>
        </div>
      </div>
    </aside>
  );
}
