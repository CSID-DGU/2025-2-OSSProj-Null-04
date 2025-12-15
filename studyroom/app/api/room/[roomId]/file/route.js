import { NextResponse } from 'next/server';
import { getCurrentUser, checkRoomMembership } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { vectorizeFileChunks } from '@/lib/vectorize/fileChunks';

const STORAGE_BUCKET =
  process.env.SUPABASE_ROOM_FILES_BUCKET || 'room-files';

export async function POST(request, context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { params } = await context;
    const { roomId } = await params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    // 강의실 멤버십 및 권한 확인
    const membership = await checkRoomMembership(roomId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: '강의실 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 게스트는 업로드 불가
    if (membership.Role === 'guest') {
      return NextResponse.json(
        { error: '게스트는 파일을 업로드할 수 없습니다' },
        { status: 403 }
      );
    }

    const supabaseService = getSupabaseServiceClient();
    if (!supabaseService) {
      console.error('Supabase service client is not configured.');
      return NextResponse.json(
        { error: '서버 환경변수가 올바르게 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    // 클라이언트 직접 업로드 후 메타데이터 저장
    const { fileName, filePath, fileType } = await request.json();

    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: '파일명과 경로가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // DB에 메타데이터 저장
    const { data: metadata, error: metadataError } = await supabase
      .from('File')
      .insert([{
        RoomID: roomId,
        FileName: fileName,
        FileUrl: filePath,
        UserID: user.id,
      }])
      .select()
      .single();

    if (metadataError) {
      console.error('File metadata insert error:', metadataError);
      await supabaseService.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

      return NextResponse.json(
        { error: '파일 메타데이터 저장에 실패했습니다' },
        { status: 500 }
      );
    }

    // 벡터화 처리 (백그라운드 - 실패해도 업로드는 성공)
    try {
      await vectorizeFileChunks({
        fileId: metadata?.FileID,
        roomId,
        fileName,
        filePath,
        fileBuffer: null, // 파일은 이미 업로드됨
        fileMime: fileType || '',
      });
    } catch (vectorError) {
      console.error('File chunk embedding error:', vectorError);
      // 벡터화 실패는 업로드 성공에 영향 주지 않음
    }

    return NextResponse.json(
      {
        success: true,
        file: {
          id: metadata?.FileID ?? null,
          name: fileName,
          url: filePath,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('File metadata save error:', error);
    return NextResponse.json(
      { error: '파일 메타데이터 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function GET(request, context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { params } = await context;
    const { roomId } = await params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('File')
      .select('FileID, FileName, FileUrl, UploadedAt, UserID')
      .eq('RoomID', roomId)
      .order('UploadedAt', { ascending: false });

    if (error) {
      console.error('File list fetch error:', error);
      return NextResponse.json(
        { error: '파일 목록을 불러오지 못했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { files: data ?? [] },
      { status: 200 }
    );
  } catch (error) {
    console.error('File list error:', error);
    return NextResponse.json(
      { error: '파일 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
