import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { vectorizeFileChunks } from '@/lib/vectorize/fileChunks';

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { roomId } = params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const fileId = body?.fileId;
    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: fileRecord, error: fileError } = await supabase
      .from('File')
      .select('FileID, RoomID, FileName, FileUrl, UserID')
      .eq('FileID', fileId)
      .eq('RoomID', roomId)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (fileRecord.UserID !== user.id) {
      return NextResponse.json(
        { error: '파일 처리 권한이 없습니다' },
        { status: 403 }
      );
    }

    const result = await vectorizeFileChunks({
      fileId: fileRecord.FileID,
      roomId: fileRecord.RoomID,
      fileName: fileRecord.FileName,
      filePath: fileRecord.FileUrl,
    });

    return NextResponse.json(
      {
        success: true,
        chunks: result?.chunkCount ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('File chunk regeneration error:', error);
    return NextResponse.json(
      { error: '파일 임베딩 재생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
