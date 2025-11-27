import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 강의실의 퀴즈 목록 조회
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { roomId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 강의실 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 멤버가 아닙니다' }, { status: 403 });
    }

    // 퀴즈 목록 조회 (문제 개수 포함)
    const { data: quizzes, error } = await supabase
      .from('Quiz')
      .select(`
        *,
        Question (
          QuestionID
        )
      `)
      .eq('QuizRoomID', roomId)
      .order('CreatedAt', { ascending: false });

    if (error) {
      console.error('퀴즈 조회 오류:', error);
      return NextResponse.json({ error: '퀴즈 목록을 불러올 수 없습니다' }, { status: 500 });
    }

    // 문제 개수 추가
    const quizList = quizzes.map(quiz => ({
      ...quiz,
      questionCount: quiz.Question?.length || 0
    }));

    return NextResponse.json({ quizzes: quizList });
  } catch (err) {
    console.error('퀴즈 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
