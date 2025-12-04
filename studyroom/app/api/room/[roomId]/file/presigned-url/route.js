import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

const STORAGE_BUCKET = process.env.SUPABASE_ROOM_FILES_BUCKET || 'room-files';

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

        const { fileName, fileType } = await request.json();
        if (!fileName) {
            return NextResponse.json(
                { error: '파일명이 필요합니다' },
                { status: 400 }
            );
        }

        const supabaseService = getSupabaseServiceClient();
        if (!supabaseService) {
            return NextResponse.json(
                { error: '서버 환경변수가 올바르게 설정되지 않았습니다' },
                { status: 500 }
            );
        }

        // 파일 경로 생성
        const safeName = fileName
            .normalize('NFC')
            .replace(/[^\w.\-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        const finalName = safeName || 'upload.bin';
        const filePath = `rooms/${roomId}/${Date.now()}-${finalName}`;

        // Presigned URL 생성
        const { data, error } = await supabaseService.storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error('Presigned URL 생성 오류:', error);
            return NextResponse.json(
                { error: 'Presigned URL 생성에 실패했습니다' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                token: data.token,
                path: data.path,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Presigned URL API 오류:', error);
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다' },
            { status: 500 }
        );
    }
}
