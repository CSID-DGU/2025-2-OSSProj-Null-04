'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (res.ok) {
        router.push('/login');
      }
    } catch (err) {
      console.error('로그아웃 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-3 py-1.5 text-red-700 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
    >
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
