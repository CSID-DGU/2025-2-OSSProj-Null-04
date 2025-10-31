'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });

      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('로그아웃 실패:', error);
      alert('로그아웃 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors duration-200 disabled:bg-gray-400"
    >
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
