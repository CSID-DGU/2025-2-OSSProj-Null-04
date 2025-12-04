'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (res.ok) {
        // 모든 캐시 초기화
        queryClient.clear();

        // localStorage도 초기화 (업로드 중인 파일 등)
        try {
          // uploading_files_ 로 시작하는 키 모두 삭제
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('uploading_files_')) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {
          console.error('localStorage 초기화 실패:', e);
        }

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
      {loading ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}