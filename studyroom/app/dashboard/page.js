'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import LogoutButton from './LogoutButton';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // 타이머 상태
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 초 단위
  const [totalStudyTime, setTotalStudyTime] = useState(0); // 분 단위

  // 일정 상태
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 타이머 interval ref
  const timerRef = useRef(null);

  // 컴포넌트 마운트 시 인증 확인 및 데이터 로드
  useEffect(() => {
    checkAuth();
  }, []);

  // 타이머 실행
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // 인증 확인
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        loadStudyTime();
        loadSchedules();
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('인증 확인 오류:', err);
      router.push('/login');
    }
  };

  // 공부시간 조회
  const loadStudyTime = async () => {
    try {
      const res = await fetch('/api/main/studytime');

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setTotalStudyTime(data.totalStudyTime || 0);

      if (data.activeTimer) {
        setIsRunning(true);
        const startTime = new Date(data.activeTimer.saveTime);
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
        setCurrentTime(elapsed);
      }
    } catch (err) {
      console.error('공부시간 조회 오류:', err);
      setError('공부시간을 불러오는데 실패했습니다');
    }
  };

  // 일정 조회
  const loadSchedules = async () => {
    try {
      setLoading(true);

      const roomsRes = await fetch('/api/room');

      if (roomsRes.status === 401) {
        router.push('/login');
        return;
      }

      const roomsData = await roomsRes.json();

      if (!roomsRes.ok) {
        setError(roomsData.error);
        setLoading(false);
        return;
      }

      const allSchedules = [];

      // owner와 member 배열을 합쳐서 모든 방 목록 가져오기
      const allRooms = [...(roomsData.owner || []), ...(roomsData.member || [])];

      for (const room of allRooms) {
        const scheduleRes = await fetch(`/api/room/${room.RoomID}/schedule`);

        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json();
          const schedulesWithRoom = (scheduleData.schedules || []).map(schedule => ({
            ...schedule,
            roomName: room.RoomName,
          }));
          allSchedules.push(...schedulesWithRoom);
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const schedulesWithDday = allSchedules
        .map(schedule => {
          const eventDate = new Date(schedule.EventDate);
          eventDate.setHours(0, 0, 0, 0);
          const diffTime = eventDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            ...schedule,
            dday: diffDays,
          };
        })
        .filter(schedule => schedule.dday >= 0)
        .sort((a, b) => a.dday - b.dday)
        .slice(0, 10);

      setSchedules(schedulesWithDday);
    } catch (err) {
      console.error('일정 조회 오류:', err);
      setError('일정을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 타이머 시작/재개
  const handleStart = async () => {
    // 타이머가 0이면 새로 시작 (DB에 기록)
    if (currentTime === 0) {
      try {
        const res = await fetch('/api/main/studytime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error);
          return;
        }

        setIsRunning(true);
      } catch (err) {
        console.error('타이머 시작 오류:', err);
        alert('타이머 시작에 실패했습니다');
      }
    } else {
      // 일시정지 상태에서 재개 (프론트엔드만)
      setIsRunning(true);
    }
  };

  // 타이머 일시정지
  const handlePause = () => {
    setIsRunning(false);
  };

  // 타이머 리셋 (총 공부시간에 누적)
  const handleReset = async () => {
    if (currentTime === 0) {
      alert('기록할 시간이 없습니다');
      return;
    }

    try {
      const studyTimeInMinutes = Math.floor(currentTime / 60);

      const res = await fetch('/api/main/studytime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          studyTime: studyTimeInMinutes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      // 총 공부시간 업데이트하고 타이머 초기화
      setTotalStudyTime(prev => prev + studyTimeInMinutes);
      setIsRunning(false);
      setCurrentTime(0);

      alert(`${studyTimeInMinutes}분이 저장되었습니다`);
    } catch (err) {
      console.error('타이머 리셋 오류:', err);
      alert('타이머 리셋에 실패했습니다');
    }
  };

  // 시간 포맷팅 (초 -> H시간 M분 S초)
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}시간 ${minutes}분 ${secs}초`;
  };

  // 분을 시간:분 포맷으로 변환
  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  // D-day 표시
  const formatDday = (dday) => {
    if (dday === 0) return 'D-day';
    return `D-${dday}`;
  };

  // 로딩 중
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center animate-pulse">
          <div className="inline-block w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 사이드바 */}
      <Sidebar user={user} />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 sidebar-expanded-content p-8">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                환영합니다, <span className="text-primary-600">{user.name}</span>님!
              </h1>
              <LogoutButton />
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* 강의실 일정 영역 - D-day로 변경 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              나의 강의실 일정
            </h2>

            {loading ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400 animate-pulse">
                <div className="inline-block w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-medium">일정을 불러오는 중...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <p className="text-lg">강의실 일정이 여기에 표시됩니다.</p>
                <p className="text-sm mt-2">(가까운 일정 순으로 정렬)</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.EventID}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {schedule.EventTitle}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {schedule.roomName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(schedule.EventDate).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <span
                        className={`inline-block px-4 py-2 rounded-full text-xl font-bold ${schedule.dday === 0
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : schedule.dday <= 7
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                      >
                        {formatDday(schedule.dday)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 타이머 & 공부시간 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 타이머 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                스터디 타이머
              </h2>

              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400 mb-6">
                  {formatTime(currentTime)}
                </div>

                <div className="flex justify-center gap-3">
                  {/* 시작 버튼 (실행 중이 아닐 때만 표시) */}
                  {!isRunning && (
                    <button
                      onClick={handleStart}
                      className="px-6 py-2 bg-blue-600 text-white text-base font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      시작
                    </button>
                  )}

                  {/* 일시정지 버튼 (실행 중일 때만 표시) */}
                  {isRunning && (
                    <button
                      onClick={handlePause}
                      className="px-6 py-2 bg-yellow-600 text-white text-base font-semibold rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      일시정지
                    </button>
                  )}

                  {/* 리셋 버튼 (시간이 있을 때만 활성화) */}
                  <button
                    onClick={handleReset}
                    disabled={currentTime === 0}
                    className="px-6 py-2 bg-red-600 text-white text-base font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    리셋
                  </button>
                </div>
              </div>
            </div>

            {/* 오늘 공부 시간 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                오늘 총 공부시간
              </h2>
              <div className="text-center">
                <div className="text-5xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {formatMinutes(totalStudyTime)}
                </div>
                <p className="text-gray-600 dark:text-gray-400">누적 학습 시간</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}