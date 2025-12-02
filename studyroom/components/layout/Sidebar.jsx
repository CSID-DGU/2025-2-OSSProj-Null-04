'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import NProgress from 'nprogress';

export default function Sidebar({ user }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  // Link 클릭 시 프로그레스 바 시작
  const handleLinkClick = () => {
    NProgress.start();
  };

  // TanStack Query로 강의실 목록 캐싱
  const { data: rooms = { owner: [], member: [] }, isLoading: loading } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await fetch('/api/room');
      if (!res.ok) {
        throw new Error('강의실 목록 조회 실패');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분간 fresh
  });

  // 사이드바 상태를 body에 반영
  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const isActive = (path) => pathname.startsWith(path);

  return (
    <div
      className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 flex flex-col ${isCollapsed ? 'w-16' : 'w-56'
        }`}
    >
      {/* 로고 영역 */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <Link href="/dashboard" className="text-lg font-bold text-primary-600">
            StudyRoom
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="사이드바 토글"
        >
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* 메뉴 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 홈 버튼 */}
        <Link
          href="/dashboard"
          onClick={handleLinkClick}
          className={`flex items-center gap-3 px-3 py-1.5 rounded-md mb-1 transition-all border-l-3 ${pathname === '/dashboard'
            ? 'border-primary-600 bg-transparent text-primary-700 font-medium'
            : 'border-transparent hover:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {!isCollapsed && <span className="font-medium text-sm">홈</span>}
        </Link>

        {/* 운영중인 스터디 */}
        {!isCollapsed && (
          <div className="mt-5">
            <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              운영중인 스터디
            </h3>
            {loading ? (
              <div className="px-3 py-1.5 text-sm text-gray-500">로딩중...</div>
            ) : rooms.owner.length === 0 ? (
              <div className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">운영중인 스터디가 없습니다</div>
            ) : (
              rooms.owner.map((room) => (
                <Link
                  key={room.RoomID}
                  href={`/room/${room.RoomID}/file`}
                  onClick={handleLinkClick}
                  className={`block px-3 py-1.5 rounded-md text-sm transition-all border-l-3 ${isActive(`/room/${room.RoomID}`)
                    ? 'border-primary-600 bg-transparent text-primary-700 font-medium'
                    : 'border-transparent hover:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  {room.RoomName}
                </Link>
              ))
            )}
          </div>
        )}

        {/* 축소된 사이드바에서 운영중인 스터디 */}
        {isCollapsed && !loading && rooms.owner.length > 0 && (
          <div className="mt-3 space-y-2">
            {rooms.owner.map((room) => (
              <Link
                key={room.RoomID}
                href={`/room/${room.RoomID}/file`}
                onClick={handleLinkClick}
                className={`flex items-center justify-center w-10 h-10 rounded-md transition-all mx-auto ${isActive(`/room/${room.RoomID}`)
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                title={room.RoomName}
              >
                <span className="text-sm font-semibold">
                  {room.RoomName.charAt(0)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* 참여중인 스터디 */}
        {!isCollapsed && (
          <div className="mt-5">
            <h3 className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              참여중인 스터디
            </h3>
            {loading ? (
              <div className="px-3 py-1.5 text-sm text-gray-500">로딩중...</div>
            ) : rooms.member.length === 0 ? (
              <div className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">참여중인 스터디가 없습니다</div>
            ) : (
              rooms.member.map((room) => (
                <Link
                  key={room.RoomID}
                  href={`/room/${room.RoomID}/file`}
                  onClick={handleLinkClick}
                  className={`block px-3 py-1.5 rounded-md text-sm transition-all border-l-3 ${isActive(`/room/${room.RoomID}`)
                    ? 'border-primary-600 bg-transparent text-primary-700 font-medium'
                    : 'border-transparent hover:border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  {room.RoomName}
                </Link>
              ))
            )}
          </div>
        )}

        {/* 축소된 사이드바에서 참여중인 스터디 */}
        {isCollapsed && !loading && rooms.member.length > 0 && (
          <div className="mt-3 space-y-2">
            {rooms.member.map((room) => (
              <Link
                key={room.RoomID}
                href={`/room/${room.RoomID}/file`}
                onClick={handleLinkClick}
                className={`flex items-center justify-center w-10 h-10 rounded-md transition-all mx-auto ${isActive(`/room/${room.RoomID}`)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                title={room.RoomName}
              >
                <span className="text-sm font-semibold">
                  {room.RoomName.charAt(0)}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* 강의실 추가 버튼 */}
        <div className={`${!isCollapsed && 'mt-5'} ${isCollapsed && 'mt-3'}`}>
          <Link
            href="/room/add/create"
            onClick={handleLinkClick}
            className="flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {!isCollapsed && <span>강의실 추가</span>}
          </Link>
        </div>
      </div>

      {/* 계정 정보 (하단) */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name || '사용자'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || ''}
              </div>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
