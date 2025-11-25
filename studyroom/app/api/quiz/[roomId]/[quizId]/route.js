import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/quiz/[roomId]/[quizId] - 퀴즈 문제 조회
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId, quizId } = await params;
    const supabase = await createClient();

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

    // 퀴즈 정보 조회
    const { data: quiz, error: quizError } = await supabase
      .from('Quiz')
      .select('QuizID, QuizTitle, QuizRoomID')
      .eq('QuizID', quizId)
      .eq('QuizRoomID', roomId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: '퀴즈를 찾을 수 없습니다' }, { status: 404 });
    }

    // 문제 목록 조회
    const { data: questions, error: questionsError } = await supabase
      .from('Question')
      .select('QuestionID, question, optionA, optionB, optionC, optionD, correctAnswer, explanation')
      .eq('QuizID', quizId)
      .order('QuestionID', { ascending: true });

    if (questionsError) throw questionsError;

    return NextResponse.json({
      quiz: {
        QuizID: quiz.QuizID,
        QuizTitle: quiz.QuizTitle
      },
      questions: questions || []
    });
  } catch (error) {
    console.error('퀴즈 조회 실패:', error);
    return NextResponse.json(
      { error: '퀴즈를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}
