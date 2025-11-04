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

    if (!supabaseService) {
      console.error('Supabase service client is not configured.');
      return NextResponse.json(
        { error: '서버 환경변수가 올바르게 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: '업로드할 파일이 필요합니다' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const filePath = `rooms/${roomId}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json(
        { error: '파일 업로드에 실패했습니다' },
        { status: 500 }
      );
    }

    const supabase = createClient();
    const fileUrl = uploadData?.path ?? filePath;

    const { data: metadata, error: metadataError } = await supabase
      .from('File')
      .insert([{
        RoomID: roomId,
        FileName: file.name,
        FileUrl: fileUrl,
        UserID: user.id,
      }])
      .select()
      .single();

    if (metadataError) {
      console.error('RoomFile insert error:', metadataError);
      await supabaseService.storage
        .from(STORAGE_BUCKET)
        .remove([fileUrl]);

      return NextResponse.json(
        { error: '파일 메타데이터 저장에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        file: {
          id: metadata?.FileID ?? null,
          name: file.name,
          url: fileUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
