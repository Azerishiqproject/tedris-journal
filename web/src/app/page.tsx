'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to login page when the component mounts
    router.push('/login');
  }, [router]);

  // Return a minimal loading state that will be shown briefly before redirect
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-blue-600">Tedris Jurnal</h1>
        <p className="text-xl text-gray-600">Yönlendiriliyorsunuz...</p>
      </div>
    </div>
  );
}
