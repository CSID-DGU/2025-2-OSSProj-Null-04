'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateRoomPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    roomName: '',
    roomPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // 생성 성공 -> 해당 강의실 파일 페이지로 이동
      alert(`강의실이 생성되었습니다!\n참여 PIN: ${data.room.EnterPin}\n\n이 PIN을 다른 사람과 공유하세요.`);
      router.push(`/room/${data.room.RoomID}/file`);
    } catch (err) {
      setError('강의실 생성 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 min-h-screen">
      <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">강의실 생성</h1>
            <p className="text-gray-600 dark:text-gray-400">새로운 스터디 강의실을 만들어보세요</p>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <Link
              href="/room/add/create"
              className="px-4 py-2 font-medium border-b-2 border-primary-600 text-primary-600"
            >
              강의실 생성
            </Link>
            <Link
              href="/room/add/join"
              className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              강의실 참여
            </Link>
          </div>

          {/* 생성 폼 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  강의실 이름 *
                </label>
                <input
                  type="text"
                  value={formData.roomName}
                  onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white text-gray-900"
                  placeholder="예: 알고리즘 스터디"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  비밀번호 (선택사항)
                </label>
                <input
                  type="password"
                  value={formData.roomPassword}
                  onChange={(e) => setFormData({ ...formData, roomPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white text-gray-900"
                  placeholder="강의실 비밀번호"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  비워두면 PIN만으로 참여 가능합니다
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>참고:</strong> 강의실 생성 시 자동으로 6자리 참여 PIN이 발급됩니다. 이 PIN을 다른 사람과 공유하여 강의실에 초대할 수 있습니다.
                </p>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors font-medium"
                >
                  {loading ? '생성 중...' : '강의실 생성'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
    </div>
  );
}
