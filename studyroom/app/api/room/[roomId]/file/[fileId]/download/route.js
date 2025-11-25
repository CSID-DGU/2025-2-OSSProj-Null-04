import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';
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

export async function GET(request, { params }) {
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

    const supabase = await createClient();
    const { data: fileRecord, error: fileError } = await supabase
      .from('File')
      .select('FileID, FileName, FileUrl, RoomID')
      .eq('FileID', fileId)
      .eq('RoomID', roomId)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const { data: downloadData, error: downloadError } = await supabaseService
      .storage
      .from(STORAGE_BUCKET)
      .download(fileRecord.FileUrl);

    if (downloadError || !downloadData) {
      console.error('File download error:', downloadError);
      return NextResponse.json(
        { error: '파일을 다운로드할 수 없습니다' },
        { status: 500 }
      );
    }

    const arrayBuffer = await downloadData.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const response = new NextResponse(fileBuffer);

    response.headers.set('Content-Type', 'application/octet-stream');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.FileName)}"`
    );

    return response;
  } catch (error) {
    console.error('Download route error:', error);
    return NextResponse.json(
      { error: '파일 다운로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
