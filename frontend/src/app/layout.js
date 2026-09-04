import './globals.css';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { ThemeProvider } from '@/components/ThemeProvider';
import CommandPalette from '@/components/CommandPalette';

export const metadata = {
  title: 'ResolverAI — Autonomous Payment Integrity & Recovery Platform',
  description: 'Merchant-side Payment Integrity, Razorpay State Reconciliation, and Autonomous Recovery Control Plane',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <CommandPalette />
          <div style={{
            display: 'flex', width: '100vw', minHeight: '100vh',
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
          }}>
            <Sidebar />
            <main style={{
              flex: 1, padding: '24px 32px', overflowY: 'auto',
              maxWidth: '1280px',
            }}>
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
