import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
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
    const { roomId } = params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
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
    const original = file.name || 'upload.bin';
    const safeName = original
      .normalize('NFC')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    const finalName = safeName || 'upload.bin';
    const filePath = `rooms/${roomId}/${Date.now()}-${finalName}`;

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

    const supabase = await createClient();
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

    try {
      await vectorizeFileChunks({
        fileId: metadata?.FileID,
        roomId,
        fileName: file.name,
        filePath: fileUrl,
        fileBuffer,
        fileMime: file.type || '',
      });
    } catch (vectorError) {
      console.error('File chunk embedding error:', vectorError);
      await supabaseService.storage.from(STORAGE_BUCKET).remove([fileUrl]);
      await supabase.from('File').delete().eq('FileID', metadata?.FileID);
      return NextResponse.json(
        { error: '파일 임베딩 생성에 실패했습니다' },
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
    const { roomId } = params ?? {};
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
