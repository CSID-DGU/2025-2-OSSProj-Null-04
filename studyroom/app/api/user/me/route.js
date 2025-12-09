import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 현재 로그인한 사용자 정보 조회
export async function GET() {
  const supabase = await createClient();

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // User 테이블에서 추가 정보 가져오기
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('name')
      .eq('UserID', user.id)
      .single();

    if (userError) {
      console.error('사용자 정보 조회 오류:', userError);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: userData?.name || user.user_metadata?.name || '사용자',
      },
    });
  } catch (err) {
    console.error('사용자 정보 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
