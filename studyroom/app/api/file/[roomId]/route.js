import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/file/[roomId] - 강의실의 파일 목록 조회
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId } = params;
    const supabase = createClient();

    // 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 접근 권한이 없습니다' }, { status: 403 });
    }

    // 파일 목록 조회
    const { data: files, error } = await supabase
      .from('File')
      .select(`
        FileID,
        FileName,
        FileUrl,
        UploadedAt,
        User:UserID (
          name
        )
      `)
      .eq('RoomID', roomId)
      .order('UploadedAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ files: files || [] });
  } catch (error) {
    console.error('파일 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '파일 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}
