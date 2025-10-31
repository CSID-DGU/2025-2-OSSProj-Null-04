import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // 유효성 검사
    if (!email || !password) {
      return Response.json(
        { error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Supabase Auth로 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return Response.json(
        { error: '이메일 또는 비밀번호가 틀렸습니다' },
        { status: 401 }
      );
    }

    if (!authData.user) {
      return Response.json(
        { error: '로그인에 실패했습니다' },
        { status: 401 }
      );
    }

    // User 테이블에서 추가 정보 가져오기
    const { data: userData } = await supabase
      .from('User')
      .select('name')
      .eq('UserID', authData.user.id)
      .single();

    const userName = userData?.name || authData.user.user_metadata?.name || '사용자';

    return Response.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: userName,
      },
      message: '로그인되었습니다',
    });

  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}