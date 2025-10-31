import { requireAuth } from '@/lib/auth';
import LogoutButton from './LogoutButton';

export default async function DashboardPage() {
  // 로그인 필수 - 로그인 안되어 있으면 자동으로 /login으로 리다이렉트
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-light to-white dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              환영합니다, <span className="text-primary">{user.name}</span>님!
            </h1>
            <LogoutButton />
          </div>
        </div>

        {/* 강의실 일정 영역 (추후 구현) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            나의 강의실 일정
          </h2>
          <div className="text-center py-12 text-gray-text dark:text-gray-400">
            <p className="text-lg">강의실 일정이 여기에 표시됩니다.</p>
            <p className="text-sm mt-2">(가까운 일정 순으로 정렬)</p>
          </div>
        </div>
      </div>
    </div>
  );
}