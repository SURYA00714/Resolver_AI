'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, CreditCard, AlertTriangle, Webhook, FileText, Plug,
  ShieldCheck, FlaskConical, Settings, Search, LogOut, PlusCircle,
} from 'lucide-react';

const COMMANDS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'Navigation' },
  { label: 'Payments', href: '/payments', icon: CreditCard, group: 'Navigation' },
  { label: 'Create Order', href: '/payments/new', icon: PlusCircle, group: 'Navigation' },
  { label: 'Reconciliation Cases', href: '/cases', icon: AlertTriangle, group: 'Navigation' },
  { label: 'Webhooks', href: '/webhooks', icon: Webhook, group: 'Navigation' },
  { label: 'Audit Trail', href: '/audit', icon: FileText, group: 'Navigation' },
  { label: 'AI Test Lab', href: '/engineering/ai-test-lab', icon: ShieldCheck, group: 'Intelligence' },
  { label: 'Chaos Lab', href: '/engineering/testing', icon: FlaskConical, group: 'Engineering' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'System' },
  { label: 'Integration Health', href: '/settings/integration', icon: Plug, group: 'System' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  const filtered = COMMANDS.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(v => !v);
      setQuery('');
      setActiveIdx(0);
    }
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[activeIdx]) {
      router.push(filtered[activeIdx].href);
      setOpen(false);
    }
  }, [open, filtered, activeIdx, router]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-dialog fade-in" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search pages..."
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            style={{ paddingLeft: 0, borderBottom: 'none' }}
          />
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)' }} />
        <div className="cmd-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              No results found
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.href}
                  className={`cmd-item ${idx === activeIdx ? 'cmd-item-active' : ''}`}
                  onClick={() => { router.push(cmd.href); setOpen(false); }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <Icon size={16} />
                  <span>{cmd.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{cmd.group}</span>
                </div>
              );
            })
          )}
        </div>
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '16px', fontSize: '0.6875rem', color: 'var(--text-muted)',
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
