import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request, { params }) {
  try {
    // 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { roomId } = await params;
    const supabase = await createClient();

    // 사용자의 강의실 멤버십 및 역할 조회
    const { data: membership, error: memberError } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: '강의실 멤버가 아닙니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      userId: user.id,
      role: membership.Role
    });
  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
