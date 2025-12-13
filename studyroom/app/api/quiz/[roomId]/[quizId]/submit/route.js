import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/quiz/[roomId]/[quizId]/submit - 퀴즈 답안 제출 및 AI 일괄 채점
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId, quizId } = await params;
    const { userAnswers } = await request.json(); // userAnswers: { questionId: answer, ... }

    if (!userAnswers || typeof userAnswers !== 'object') {
      return NextResponse.json({ error: '답안 형식이 올바르지 않습니다' }, { status: 400 });
    }

    const supabase = await createClient();

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

    // 문제 조회 (모든 정보 필요)
    const { data: questions } = await supabase
      .from('Question')
      .select('*')
      .eq('QuizID', quizId);

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: '문제를 찾을 수 없습니다' }, { status: 404 });
    }

    // 1. 객관식 문제는 즉시 채점 (비용 절약)
    const mcqResults = [];
    const subjectiveQuestions = [];

    questions.forEach(q => {
      const questionType = q.questionType || 'MCQ';
      const userAnswer = userAnswers[q.QuestionID] || '';

      if (questionType === 'MCQ') {
        const isCorrect = q.correctAnswer === userAnswer;
        mcqResults.push({
          questionId: q.QuestionID,
          isCorrect,
          feedback: isCorrect ? '정답입니다!' : `정답은 ${q.correctAnswer}입니다.`
        });
      } else {
        // 주관식 문제는 AI 채점용으로 분리
        subjectiveQuestions.push({
          ...q,
          userAnswer
        });
      }
    });

    // 2. 주관식 문제(short/essay)만 AI 채점
    let aiResults = [];

    if (subjectiveQuestions.length > 0) {
      const gradingPrompt = `다음 ${subjectiveQuestions.length}개 문제의 답변을 채점하고, 학생에게 구체적이고 교육적인 피드백을 제공해주세요.

${subjectiveQuestions.map((q, i) => `
---
문제 ${i + 1} [${q.questionType === 'short' ? '단답형' : '서술형'}]
문제: ${q.question}
정답/모범답안: ${q.correctAnswer}
학생 답변: ${q.userAnswer || '(미작성)'}
해설: ${q.explanation || ''}
`).join('\n')}

채점 기준:
- 단답형: 정답과 동일하거나 동의어/유사한 표현이면 정답 (너그럽게 채점)
- 서술형: 모범답안의 핵심 내용을 포함하면 정답

피드백 작성 지침:
1. **정답인 경우**: 
   - 잘한 점을 구체적으로 칭찬
   - 추가로 알면 좋을 관련 개념이나 심화 내용 제시
   
2. **오답인 경우**:
   - 어떤 부분이 틀렸는지 명확히 설명
   - 올바른 답과 학생 답변의 차이점 설명
   - 이 문제를 맞추기 위해 공부해야 할 개념/내용 제시
   - 가능하면 추가 학습 방향 제시

3. **미작성인 경우**:
   - 핵심 개념과 정답 설명
   - 이 문제가 왜 중요한지 설명

피드백은 2-4문장 정도로 구체적이고 교육적으로 작성하세요.

JSON 응답 형식 (반드시 ${subjectiveQuestions.length}개):
{
  "results": [
    { 
      "questionIndex": 0, 
      "isCorrect": true/false, 
      "feedback": "구체적이고 교육적인 피드백 (2-4문장)"
    }
  ]
}`;

      const aiResult = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: gradingPrompt }],
        response_format: { type: "json_object" }
      });

      const aiGrading = JSON.parse(aiResult.choices[0].message.content);

      aiResults = aiGrading.results.map((result, i) => ({
        questionId: subjectiveQuestions[i].QuestionID,
        isCorrect: result.isCorrect,
        feedback: result.feedback
      }));
    }

    // 3. 결과 병합
    const allResults = [...mcqResults, ...aiResults];

    // 점수 계산
    const correctCount = allResults.filter(r => r.isCorrect).length;
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
    const answerRecords = allResults.map(result => ({
      userAnswer: userAnswers[result.questionId] || '',
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
      results: allResults,
      attemptId: attempt.AttemptID
    });
  } catch (error) {
    console.error('답안 제출 실패:', error);
    return NextResponse.json(
      { error: error.message || '답안 제출에 실패했습니다' },
      { status: 500 }
    );
  }
}
