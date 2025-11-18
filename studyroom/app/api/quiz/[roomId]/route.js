import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/quiz/[roomId] - 강의실의 모든 퀴즈 목록 조회
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId } = params;
    const supabase = createClient();

    // 해당 강의실의 멤버인지 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 접근 권한이 없습니다' }, { status: 403 });
    }

    // 퀴즈 목록 조회 (문제 개수도 함께)
    const { data: quizzes, error } = await supabase
      .from('Quiz')
      .select(`
        QuizID,
        QuizTitle,
        Question (
          QuestionID
        )
      `)
      .eq('QuizRoomID', roomId)
      .order('QuizTitle', { ascending: true });

    if (error) throw error;

    // 문제 개수 계산
    const quizList = quizzes.map(quiz => ({
      QuizID: quiz.QuizID,
      QuizTitle: quiz.QuizTitle,
      questionCount: quiz.Question?.length || 0
    }));

    return NextResponse.json({ quizzes: quizList });
  } catch (error) {
    console.error('퀴즈 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '퀴즈 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}
