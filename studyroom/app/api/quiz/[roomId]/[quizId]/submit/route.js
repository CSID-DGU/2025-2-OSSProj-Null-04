import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// POST /api/quiz/[roomId]/[quizId]/submit - 퀴즈 답안 제출 및 채점
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId, quizId } = params;
    const { answers } = await request.json(); // answers: [{ questionId, userAnswer }, ...]

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: '답안 형식이 올바르지 않습니다' }, { status: 400 });
    }

    const supabase = createClient();

    // 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 접근 권한이 없습니다' }, { status: 403 });
    }

    // 퀴즈 존재 확인
    const { data: quiz } = await supabase
      .from('Quiz')
      .select('QuizID')
      .eq('QuizID', quizId)
      .eq('QuizRoomID', roomId)
      .single();

    if (!quiz) {
      return NextResponse.json({ error: '퀴즈를 찾을 수 없습니다' }, { status: 404 });
    }

    // 정답 조회
    const { data: questions } = await supabase
      .from('Question')
      .select('QuestionID, correctAnswer')
      .eq('QuizID', quizId);

    if (!questions) {
      return NextResponse.json({ error: '문제를 찾을 수 없습니다' }, { status: 404 });
    }

    // 채점
    const correctAnswerMap = {};
    questions.forEach(q => {
      correctAnswerMap[q.QuestionID] = q.correctAnswer;
    });

    let correctCount = 0;
    const results = answers.map(answer => {
      const isCorrect = correctAnswerMap[answer.questionId] === answer.userAnswer;
      if (isCorrect) correctCount++;

      return {
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        correctAnswer: correctAnswerMap[answer.questionId],
        isCorrect
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);

    // QuizAttempt 저장
    const { data: attempt, error: attemptError } = await supabase
      .from('QuizAttempt')
      .insert({
        Score: score.toString(),
        CompletedAt: new Date().toISOString(),
        UserID: user.id,
        QuizID: quizId
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // Answer 저장
    const answerRecords = results.map(result => ({
      userAnswer: result.userAnswer,
      isCorrect: result.isCorrect,
      QuestionID: result.questionId,
      AttemptID: attempt.AttemptID
    }));

    const { error: answersError } = await supabase
      .from('Answer')
      .insert(answerRecords);

    if (answersError) throw answersError;

    return NextResponse.json({
      score,
      correctCount,
      totalCount: questions.length,
      results,
      attemptId: attempt.AttemptID
    });
  } catch (error) {
    console.error('답안 제출 실패:', error);
    return NextResponse.json(
      { error: '답안 제출에 실패했습니다' },
      { status: 500 }
    );
  }
}
