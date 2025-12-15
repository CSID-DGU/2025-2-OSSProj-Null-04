import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getCurrentUser, checkRoomMembership } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const STORAGE_BUCKET =
  process.env.SUPABASE_ROOM_FILES_BUCKET || 'room-files';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseService =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { roomId, fileId } = await params ?? {};
    if (!roomId || !fileId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    if (!supabaseService) {
      return NextResponse.json(
        { error: '서버 구성이 올바르지 않습니다' },
        { status: 500 }
      );
    }

    // 1. 멤버십 확인
    const membership = await checkRoomMembership(roomId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: '강의실 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 2. 게스트는 삭제 불가
    if (membership.Role === 'guest') {
      return NextResponse.json(
        { error: '게스트는 파일을 삭제할 수 없습니다' },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { data: fileRecord, error: fileError } = await supabase
      .from('File')
      .select('FileID, FileName, FileUrl, RoomID, UserID')
      .eq('FileID', fileId)
      .eq('RoomID', roomId)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 3. 본인이 업로드한 파일만 삭제 가능 (owner는 모든 파일 삭제 가능)
    const isFileOwner = fileRecord.UserID === user.id;
    const isRoomOwner = membership.Role === 'owner';

    if (!isFileOwner && !isRoomOwner) {
      return NextResponse.json(
        { error: '자신이 업로드한 파일만 삭제할 수 있습니다' },
        { status: 403 }
      );
    }

    const { error: storageError } = await supabaseService
      .storage
      .from(STORAGE_BUCKET)
      .remove([fileRecord.FileUrl]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return NextResponse.json(
        { error: '파일 삭제에 실패했습니다' },
        { status: 500 }
      );
    }

    const { error: dbError } = await supabase
      .from('File')
      .delete()
      .eq('FileID', fileId);

    if (dbError) {
      console.error('DB delete error:', dbError);
      return NextResponse.json(
        { error: '파일 정보 삭제에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('File delete error:', error);
    return NextResponse.json(
      { error: '파일 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
