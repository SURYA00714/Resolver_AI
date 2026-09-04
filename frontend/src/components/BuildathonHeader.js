'use client';

import { RefreshCw, PlusCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function BuildathonHeader({ loading, loadData }) {
  return (
    <div className="page-header" style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ fontSize: '1.375rem', margin: 0 }}>
              ResolverAI Operations Control Center
            </h1>
            <span className="badge badge-info" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
              Test Mode
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>
            Autonomous payment state intelligence, 3-way reconciliation & dispute resolution
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={loadData} className="btn btn-secondary btn-sm" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <Link href="/payments/new" className="btn btn-primary btn-sm">
            <PlusCircle size={13} />
            Create Order
          </Link>
        </div>
      </div>
    </div>
  );
}
