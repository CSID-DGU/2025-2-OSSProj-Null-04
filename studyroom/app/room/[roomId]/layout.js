import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import RoomNavBar from '@/components/layout/RoomNavBar';
import RoomCodeCopy from '@/components/layout/RoomCodeCopy';
import { redirect } from 'next/navigation';

export default async function RoomIdLayout({ children, params }) {
  // 로그인 필수
  const user = await requireAuth();

  const { roomId } = await params;
  const supabase = await createClient();

  // 강의실 정보 조회
  const { data: room, error } = await supabase
    .from('Room')
    .select('RoomID, RoomName, EnterPin')
    .eq('RoomID', roomId)
    .single();

  // 강의실이 없으면 대시보드로 리다이렉트
  if (error || !room) {
    redirect('/dashboard');
  }

  // 사용자 역할 조회
  const { data: membership } = await supabase
    .from('RoomMember')
    .select('Role')
    .eq('UserID', user.id)
    .eq('RoomID', roomId)
    .single();

  const userRole = membership?.Role || null;

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
      {/* 헤더: 방 이름 + 강의실 코드 */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-3 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {room.RoomName}
          </h1>
          <RoomCodeCopy enterPin={room.EnterPin} />
        </div>
      </div>

      {/* 네비게이션 바 */}
      <RoomNavBar roomId={roomId} userRole={userRole} />

      {/* 페이지 콘텐츠 */}
      <div className="flex-1 p-5 bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
