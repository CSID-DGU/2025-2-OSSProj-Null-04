import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRelevantChunks } from '@/lib/vectorize/semanticSearch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/quiz/generate - AI 퀴즈 생성
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { fileIds, questionCount, difficulty, quizTitle } = await request.json();

    // 난이도별 프롬프트 조정
    const difficultyMap = {
      easy: '쉬운',
      medium: '보통',
      hard: '어려운'
    };
    const difficultyText = difficultyMap[difficulty] || '보통';

    let context = '';
    let useRAG = false;

    // 파일이 선택된 경우: 임베딩 기반 RAG 사용
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      useRAG = true;

      // 의미론적 검색으로 관련 청크 가져오기
      // quizTitle을 기반으로 광범위한 주제 vs 구체적 주제 자동 감지
      context = await getRelevantChunks(quizTitle || '', fileIds, 8000);

      if (!context) {
        return NextResponse.json({ error: '선택한 파일에 처리된 내용이 없습니다' }, { status: 400 });
      }

      console.log(`[Quiz Generate] 컨텍스트 ${context.length}자 사용`);
    }

    // OpenAI API 호출
    let userPrompt;

    if (useRAG) {
      // 파일 기반 퀴즈 생성 (RAG)
      userPrompt = `주제: "${quizTitle || '제공된 학습 자료'}"

다음 학습 자료를 바탕으로 위 주제에 관한 ${questionCount}개의 객관식 문제를 생성해주세요.

**중요:** 학습 자료에 직접적인 내용이 없더라도, 위 주제와 관련된 문제를 반드시 포함해야 합니다.

학습 자료:
${context}

요구사항:
- 주제 "${quizTitle || '학습 자료'}"를 반드시 반영한 문제 생성
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제, 문제 풀이로 관련 내용을 정리할 수 있는 문제
- 총 ${questionCount}개의 문제 (학습 자료 기반 + 주제 관련)
- 각 문제는 4개의 선택지 (A, B, C, D)를 가짐
- **정답을 A, B, C, D에 골고루 분산** (예: 5문제면 A:1-2개, B:1-2개, C:1-2개, D:1-2개)
- 모든 오답 선택지는 그럴듯하고 비슷한 길이여야 함
- 난이도: ${difficultyText}
- 각 문제에 대한 상세한 해설 포함

응답 형식 (JSON):
{
  "questions": [
    {
      "question": "문제 내용",
      "optionA": "선택지 A",
      "optionB": "선택지 B",
      "optionC": "선택지 C",
      "optionD": "선택지 D",
      "correctAnswer": "A",
      "explanation": "해설 내용"
    }
  ]
}`;
    } else {
      // 주제 기반 퀴즈 생성 (파일 없음)
      if (!quizTitle || !quizTitle.trim()) {
        return NextResponse.json({ error: '퀴즈 제목을 입력해주세요' }, { status: 400 });
      }

      userPrompt = `주제: "${quizTitle}"

위 주제에 대한 ${questionCount}개의 객관식 문제를 생성해주세요.

요구사항:
- 주제 "${quizTitle}"와 관련된 실용적이고 교육적인 문제
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제, 문제 풀이로 관련 내용을 정리할 수 있는 문제
- 총 ${questionCount}개의 문제를 생성
- 각 문제는 4개의 선택지 (A, B, C, D)를 가짐
- **정답을 A, B, C, D에 골고루 분산** (예: 5문제면 A:1-2개, B:1-2개, C:1-2개, D:1-2개)
- 모든 오답 선택지는 그럴듯하고 비슷한 길이여야 함
- 난이도: ${difficultyText}
- 각 문제에 대한 상세한 해설 포함

응답 형식 (JSON):
{
  "questions": [
    {
      "question": "문제 내용",
      "optionA": "선택지 A",
      "optionB": "선택지 B",
      "optionC": "선택지 C",
      "optionD": "선택지 D",
      "correctAnswer": "A",
      "explanation": "해설 내용"
    }
  ]
}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        {
          role: 'system',
          content: `당신은 교육용 퀴즈를 생성하는 전문 AI입니다.

핵심 규칙:
1. 정답을 A, B, C, D에 **골고루 분산**시켜야 합니다 (특정 번호에 몰리면 안 됨)
2. 모든 오답 선택지는 그럴듯해야 하며, 정답과 유사한 길이여야 합니다
3. 난이도: ${difficultyText}
4. 각 문제마다 명확한 해설을 제공해야 합니다`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      reasoning_effort: 'medium',  // 퀴즈 품질 향상을 위한 중간 수준 추론
    });

    const result = JSON.parse(completion.choices[0].message.content);

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error('AI 응답 형식이 올바르지 않습니다');
    }

    return NextResponse.json({
      questions: result.questions.slice(0, questionCount) // 요청한 개수만큼만 반환
    });

  } catch (error) {
    console.error('AI 퀴즈 생성 실패:', error);
    return NextResponse.json(
      { error: error.message || 'AI 퀴즈 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
