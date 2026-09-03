import './globals.css';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata = {
  title: 'ResolverAI — Autonomous Payment Integrity & Recovery Platform',
  description: 'Merchant-side Payment Integrity, Razorpay State Reconciliation, and Autonomous Recovery Control Plane',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <div style={{ display: 'flex', width: '100vw', minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <Sidebar />
            <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxWidth: '1400px', margin: '0 auto' }}>
              <AuthGuard>
                {children}
              </AuthGuard>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
