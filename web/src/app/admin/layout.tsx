'use client';

import Sidebar from '@/components/ui/sidebar/Sidebar';
import { useAppSelector } from '@/redux/hooks';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const router = useRouter();

  // Check if user is authenticated and is an admin
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user && user.role !== 'admin') {
      router.push('/unauthorized');
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {children}
      </main>
    </div>
  );
} 