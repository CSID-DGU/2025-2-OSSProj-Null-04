'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

export default function JoinRoomPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1); // 1: PIN 입력, 2: 비밀번호 입력
  const [enterPin, setEnterPin] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [foundRoom, setFoundRoom] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearchRoom = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterPin })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // 비밀번호가 필요한 경우
      if (data.needPassword) {
        setFoundRoom(data.room);
        setStep(2);
        return;
      }

      // 참여 성공
      alert(data.message || '강의실에 참여했습니다!');
      // 사이드바 강의실 목록 캐시 무효화
      queryClient.invalidateQueries(['rooms']);
      router.push(`/room/${data.room.RoomID}/file`);
    } catch (err) {
      setError('강의실 찾기 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterPin, roomPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // 참여 성공
      alert(data.message || '강의실에 참여했습니다!');
      // 사이드바 강의실 목록 캐시 무효화
      queryClient.invalidateQueries(['rooms']);
      router.push(`/room/${data.room.RoomID}/file`);
    } catch (err) {
      setError('강의실 참여 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setRoomPassword('');
    setFoundRoom(null);
    setError('');
  };

  return (
    <div className="p-8 min-h-screen">
      <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">강의실 참여</h1>
            <p className="text-gray-600 dark:text-gray-400">PIN을 입력하여 강의실에 참여하세요</p>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <Link
              href="/room/add/create"
              className="px-4 py-2 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              강의실 생성
            </Link>
            <Link
              href="/room/add/join"
              className="px-4 py-2 font-medium border-b-2 border-primary-600 text-primary-600"
            >
              강의실 참여
            </Link>
          </div>

          {/* Step 1: PIN 입력 */}
          {step === 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <form onSubmit={handleSearchRoom} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    참여 PIN *
                  </label>
                  <input
                    type="text"
                    value={enterPin}
                    onChange={(e) => setEnterPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white text-gray-900"
                    placeholder="6자리 PIN 입력"
                    maxLength={6}
                    required
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    강의실 관리자로부터 받은 6자리 PIN을 입력하세요
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
                    disabled={loading || enterPin.length !== 6}
                    className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition-colors font-medium"
                  >
                    {loading ? '찾는 중...' : '강의실 찾기'}
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
          )}

          {/* Step 2: 비밀번호 입력 */}
          {step === 2 && foundRoom && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mb-4">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>강의실을 찾았습니다!</strong>
                  </p>
                  <p className="text-lg font-semibold text-green-900 dark:text-green-100 mt-2">
                    {foundRoom.RoomName}
                  </p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  이 강의실은 비밀번호가 설정되어 있습니다. 비밀번호를 입력하여 참여하세요.
                </p>
              </div>

              <form onSubmit={handleJoinWithPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    비밀번호 *
                  </label>
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white text-gray-900"
                    placeholder="강의실 비밀번호"
                    required
                    autoFocus
                  />
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
                    {loading ? '참여 중...' : '참여하기'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    뒤로
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
    </div>
  );
}
