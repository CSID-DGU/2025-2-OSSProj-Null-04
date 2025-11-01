import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RoomNavBar from '@/components/layout/RoomNavBar';
import { redirect } from 'next/navigation';

export default async function RoomIdLayout({ children, params }) {
  // 로그인 필수
  const user = await requireAuth();

  const { roomId } = params;
  const supabase = createClient();

  // 강의실 정보 조회
  const { data: room, error } = await supabase
    .from('Room')
    .select('RoomID, RoomName')
    .eq('RoomID', roomId)
    .single();

  // 강의실이 없으면 대시보드로 리다이렉트
  if (error || !room) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더: 방 이름 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {room.RoomName}
        </h1>
      </div>

      {/* 네비게이션 바 */}
      <RoomNavBar roomId={roomId} />

      {/* 페이지 콘텐츠 */}
      <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
