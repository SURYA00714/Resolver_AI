'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') return;
    api.getAuthMe().then((me) => {
      if (!me.authenticated) {
        router.replace('/login');
      }
    }).catch(() => {
      router.replace('/login');
    });
  }, [router, pathname]);

  return children;
}
