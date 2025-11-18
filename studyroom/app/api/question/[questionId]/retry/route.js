import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST: 재풀이 답변 제출
export async function POST(request, { params }) {
  const supabase = await createClient();
  const { questionId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 요청 데이터 파싱
    const { userAnswer } = await request.json();

    if (!userAnswer) {
      return NextResponse.json({ error: '답변을 선택해주세요' }, { status: 400 });
    }

    // 문제 정보 조회
    const { data: question, error: questionError } = await supabase
      .from('Question')
      .select('QuizID, correctAnswer')
      .eq('QuestionID', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: '문제를 찾을 수 없습니다' }, { status: 404 });
    }

    // 정답 여부 확인
    const isCorrect = userAnswer === question.correctAnswer;

    // 디버깅 로그
    console.log('=== 재풀이 답변 제출 디버그 ===');
    console.log('questionId:', questionId);
    console.log('userAnswer:', userAnswer, 'type:', typeof userAnswer);
    console.log('correctAnswer:', question.correctAnswer, 'type:', typeof question.correctAnswer);
    console.log('isCorrect:', isCorrect);
    console.log('strict comparison (===):', userAnswer === question.correctAnswer);
    console.log('loose comparison (==):', userAnswer == question.correctAnswer);
    console.log('==============================');

    // QuizAttempt 생성 (재풀이용 - Score는 0으로 설정)
    const { data: attempt, error: attemptError } = await supabase
      .from('QuizAttempt')
      .insert({
        QuizID: question.QuizID,
        UserID: user.id,
        Score: 0,
      })
      .select()
      .single();

    if (attemptError) {
      console.error('QuizAttempt 생성 오류:', attemptError);
      return NextResponse.json({ error: '시도 기록을 생성할 수 없습니다' }, { status: 500 });
    }

    // Answer 저장
    const { data: answer, error: answerError } = await supabase
      .from('Answer')
      .insert({
        QuestionID: questionId,
        AttemptID: attempt.AttemptID,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
      })
      .select()
      .single();

    if (answerError) {
      console.error('답변 저장 오류:', answerError);
      return NextResponse.json({ error: '답변을 저장할 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({
      isCorrect,
      correctAnswer: question.correctAnswer,
      message: isCorrect ? '정답입니다!' : '오답입니다.',
    }, { status: 201 });
  } catch (err) {
    console.error('재풀이 제출 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
