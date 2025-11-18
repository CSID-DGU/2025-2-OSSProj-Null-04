import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 퀴즈의 문제 목록 조회
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { quizId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 문제 목록 조회
    const { data: questions, error } = await supabase
      .from('Question')
      .select('*')
      .eq('QuizID', quizId)
      .order('QuestionID', { ascending: true });

    if (error) {
      console.error('문제 조회 오류:', error);
      return NextResponse.json({ error: '문제 목록을 불러올 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (err) {
    console.error('문제 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
