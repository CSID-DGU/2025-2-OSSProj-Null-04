import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    // 유효성 검사
    if (!email || !password || !name) {
      return Response.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: '유효한 이메일 주소를 입력해주세요' },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증 (최소 8자, 영문+숫자 포함)
    if (password.length < 8) {
      return Response.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Supabase Auth로 회원가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (authError) {
      // 이메일 중복 에러 처리
      if (authError.message.includes('already registered')) {
        return Response.json(
          { error: '이미 사용 중인 이메일입니다' },
          { status: 409 }
        );
      }

      return Response.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return Response.json(
        { error: '회원가입에 실패했습니다' },
        { status: 500 }
      );
    }

    // User 테이블에 추가 정보 저장 (auth.users와 연동)
    const { error: dbError } = await supabase
      .from('User')
      .insert([{
        UserID: authData.user.id,  // auth.users의 id와 동일
        UserInputID: email,
        name: name,
      }]);

    if (dbError) {
      console.error('User table insert error:', dbError);
      // Auth는 생성되었지만 User 테이블 저장 실패
      // 나중에 트리거로 자동화할 수 있음
    }

    return Response.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: name,
      },
      message: '회원가입이 완료되었습니다',
    });

  } catch (error) {
    console.error('Register error:', error);
    return Response.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}