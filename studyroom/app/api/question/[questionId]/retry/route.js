import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// 단답형 정답 비교 함수 (대소문자/공백 무시)
const normalizeAnswer = (answer) => {
  if (!answer) return '';
  return answer.toString().toLowerCase().trim().replace(/\s+/g, '');
};

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

    // 문제 정보 조회 (questionType 추가)
    const { data: question, error: questionError } = await supabase
      .from('Question')
      .select('QuizID, correctAnswer, questionType')
      .eq('QuestionID', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: '문제를 찾을 수 없습니다' }, { status: 404 });
    }

    const questionType = question.questionType || 'MCQ';
    let isCorrect = null;
    let message = '';

    // 문제 유형별 정답 비교
    if (questionType === 'MCQ') {
      // 객관식: 정확히 일치해야 정답
      if (!userAnswer) {
        return NextResponse.json({ error: '답변을 선택해주세요' }, { status: 400 });
      }
      isCorrect = userAnswer === question.correctAnswer;
      message = isCorrect ? '정답입니다!' : '오답입니다.';
    } else if (questionType === 'short') {
      // 단답형: 대소문자/공백 무시하고 비교
      if (!userAnswer || !userAnswer.trim()) {
        return NextResponse.json({ error: '답변을 입력해주세요' }, { status: 400 });
      }
      isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer);
      message = isCorrect ? '정답입니다!' : '오답입니다.';
    } else if (questionType === 'essay') {
      // 서술형: 재풀이에서는 정답 여부 판단 안 함 (모범답안만 표시)
      isCorrect = null;
      message = '모범답안을 확인하세요.';
    }

    return NextResponse.json({
      isCorrect,
      correctAnswer: question.correctAnswer,
      questionType,
      message,
    }, { status: 200 });
  } catch (err) {
    console.error('재풀이 제출 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
