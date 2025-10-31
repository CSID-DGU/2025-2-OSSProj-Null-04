import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createClient();

    // Supabase Auth 로그아웃 (세션 및 쿠키 삭제)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return Response.json(
        { error: '로그아웃 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: '로그아웃되었습니다',
    });

  } catch (error) {
    console.error('Logout error:', error);
    return Response.json(
      { error: '로그아웃 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}