import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST: 재풀이 답변 제출 (통계에 영향 없음 - DB 저장 안 함)
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

    // 정답 여부 확인 (DB 저장 없이 결과만 반환)
    const isCorrect = userAnswer === question.correctAnswer;

    return NextResponse.json({
      isCorrect,
      correctAnswer: question.correctAnswer,
      message: isCorrect ? '정답입니다!' : '오답입니다.',
    }, { status: 200 });
  } catch (err) {
    console.error('재풀이 제출 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
