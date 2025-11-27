'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId;
  const queryClient = useQueryClient();

  // 일정 추가 폼 상태
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');

  // 일정 목록 조회 (useQuery)
  const { data: schedules = [], isLoading: loading, error } = useQuery({
    queryKey: ['schedules', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/schedule`);

      if (res.status === 401) {
        router.push('/login');
        throw new Error('Unauthorized');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '일정을 불러오는데 실패했습니다');
      }

      return data.schedules || [];
    },
    enabled: !!roomId,
    staleTime: 2 * 60 * 1000, // 2분
  });

  // 일정 추가 mutation
  const addScheduleMutation = useMutation({
    mutationFn: async ({ eventTitle, eventDate }) => {
      const res = await fetch(`/api/room/${roomId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle, eventDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '일정 추가에 실패했습니다');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['schedules', roomId]);
      setEventTitle('');
      setEventDate('');
      setIsAddingSchedule(false);
      alert('일정이 추가되었습니다');
    },
    onError: (err) => {
      alert(`일정 추가 실패: ${err.message}`);
    },
  });

  // 일정 삭제 mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (eventId) => {
      const res = await fetch(`/api/room/${roomId}/schedule?eventId=${eventId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '일정 삭제에 실패했습니다');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['schedules', roomId]);
      alert('일정이 삭제되었습니다');
    },
    onError: (err) => {
      alert(err.message || '일정 삭제에 실패했습니다');
    },
  });

  // 일정 추가
  const handleAddSchedule = (e) => {
    e.preventDefault();

    if (!eventTitle.trim() || !eventDate) {
      alert('일정명과 날짜를 모두 입력해주세요');
      return;
    }

    addScheduleMutation.mutate({
      eventTitle: eventTitle.trim(),
      eventDate,
    });
  };

  // 일정 삭제
  const handleDeleteSchedule = (eventId) => {
    if (!confirm('정말 이 일정을 삭제하시겠습니까?')) {
      return;
    }

    deleteScheduleMutation.mutate(eventId);
  };

  // D-day 계산
  const calculateDday = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(eventDate);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  // D-day 포맷
  const formatDday = (dday) => {
    if (dday === 0) return 'D-day';
    if (dday < 0) return `D+${Math.abs(dday)}`;
    return `D-${dday}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          일정 관리
        </h2>
        <button
          onClick={() => setIsAddingSchedule(!isAddingSchedule)}
          className="px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
        >
          {isAddingSchedule ? '취소' : '+ 일정 추가'}
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error.message}</p>
        </div>
      )}

      {/* 일정 추가 폼 */}
      {isAddingSchedule && (
        <form onSubmit={handleAddSchedule} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                일정명
              </label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="예: 중간고사"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                날짜
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              추가
            </button>
          </div>
        </form>
      )}

      {/* 로딩 중 */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p className="text-lg">일정을 불러오는 중...</p>
        </div>
      ) : schedules.length === 0 ? (
        /* 일정 없음 */
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p className="text-lg">등록된 일정이 없습니다</p>
          <p className="text-sm mt-2">오른쪽 상단의 '+ 일정 추가' 버튼을 눌러 일정을 추가하세요</p>
        </div>
      ) : (
        /* 일정 목록 */
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const dday = calculateDday(schedule.EventDate);
            return (
              <div
                key={schedule.EventID}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    {schedule.EventTitle}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(schedule.EventDate).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-4 py-2 rounded-full text-xl font-bold ${
                      dday === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : dday > 0 && dday <= 7
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : dday > 0
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}
                  >
                    {formatDday(dday)}
                  </span>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.EventID)}
                    className="px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
