// app/api/auth/me/route.js
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  try {
    const supabase = createClient();

    // Supabase Auth에서 현재 세션 확인
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // User 테이블에서 추가 정보 조회 (이름 등)
    const { data: userInfo, error: userError } = await supabase
      .from('User')
      .select('UserID, 이름 as name, 비밀번호 as email')
      .eq('UserID', user.id)
      .single();

    if (userError) {
      console.error('User info query error:', userError);
      // User 테이블 정보가 없어도 auth 정보는 반환
      return Response.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.email.split('@')[0], // 이메일에서 이름 추출
        },
      }, { status: 200 });
    }

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: userInfo?.name || user.email.split('@')[0],
      },
    }, { status: 200 });

  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}