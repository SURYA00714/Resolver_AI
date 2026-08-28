'use client';

import './globals.css';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';

export const metadata = {
  title: 'ResolverAI — Payment Integrity Control Plane',
  description: 'Merchant-side Payment Integrity & Auto-Recovery Platform for Razorpay',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', width: '100vw', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxWidth: '1400px', margin: '0 auto' }}>
            <AuthGuard>
              {children}
            </AuthGuard>
          </main>
        </div>
      </body>
    </html>
  );
}
