import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRelevantChunks } from '@/lib/vectorize/semanticSearch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const normalizeQuestionCounts = (counts, legacyCount) => {
  const normalized = {
    mcq: Math.max(parseInt(counts?.mcq ?? counts?.MCQ ?? 0, 10) || 0, 0),
    short: Math.max(parseInt(counts?.short ?? counts?.SHORT ?? 0, 10) || 0, 0),
    essay: Math.max(parseInt(counts?.essay ?? counts?.ESSAY ?? 0, 10) || 0, 0)
  };

  // 구형 형태(questionCount)로 들어온 경우 대비
  if ((normalized.mcq + normalized.short + normalized.essay) === 0 && legacyCount) {
    normalized.mcq = Math.max(parseInt(legacyCount, 10) || 0, 0);
  }

  return normalized;
};

const normalizeQuestionType = (type) => {
  const value = (type || 'MCQ').toString();
  if (value.toUpperCase() === 'MCQ') return 'MCQ';
  if (value.toLowerCase() === 'short') return 'short';
  if (value.toLowerCase() === 'essay') return 'essay';
  return 'MCQ';
};

const normalizeQuestions = (questions = []) =>
  questions.map((question) => {
    const questionType = normalizeQuestionType(question.questionType || question.type);
    const base = {
      questionType,
      question: question.question || question.prompt || '',
      explanation: question.explanation || question.answerGuide || question.rationale || ''
    };

    if (questionType === 'SHORT') {
      return {
        ...base,
        correctAnswer: question.correctAnswer || question.answer || ''
      };
    }

    if (questionType === 'ESSAY') {
      return {
        ...base,
        correctAnswer: question.correctAnswer || question.answerGuide || question.answer || '',
        answerGuide: question.answerGuide || question.rubric || base.explanation
      };
    }

    return {
      ...base,
      optionA: question.optionA || '',
      optionB: question.optionB || '',
      optionC: question.optionC || '',
      optionD: question.optionD || '',
      correctAnswer: (question.correctAnswer || '').toString().trim()
    };
  });

const limitQuestionsByType = (questions, counts) => {
  const quotas = {
    MCQ: counts.mcq,
    short: counts.short,
    essay: counts.essay
  };

  const usage = { MCQ: 0, short: 0, essay: 0 };
  const filtered = [];

  for (const question of questions) {
    const type = normalizeQuestionType(question.questionType || question.type);
    if (!quotas[type]) continue;
    if (usage[type] >= quotas[type]) continue;

    usage[type] += 1;
    filtered.push({ ...question, questionType: type });

    const remainingTotal = quotas.MCQ + quotas.SHORT + quotas.ESSAY - (usage.MCQ + usage.SHORT + usage.ESSAY);
    if (remainingTotal <= 0) break;
  }

  return filtered;
};

// POST /api/quiz/generate - AI 퀴즈 생성
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { fileIds, questionCounts, questionCount, difficulty, quizTitle } = await request.json();
    const desiredCounts = normalizeQuestionCounts(questionCounts, questionCount);
    const totalQuestions = desiredCounts.mcq + desiredCounts.short + desiredCounts.essay;

    if (totalQuestions <= 0) {
      return NextResponse.json({ error: '문제 수를 1개 이상 입력해주세요' }, { status: 400 });
    }

    // 난이도별 프롬프트 조정
    const difficultyMap = {
      easy: '쉬운',
      medium: '보통',
      hard: '어려운'
    };
    const difficultyText = difficultyMap[difficulty] || '보통';

    const typeRequirementText = [
      desiredCounts.mcq ? `- 객관식(MCQ): ${desiredCounts.mcq}개 (4지선다, 정답은 A/B/C/D 중 하나)` : null,
      desiredCounts.short ? `- 단답형(SHORT): ${desiredCounts.short}개 (짧은 텍스트 정답, 한 단어나 한 문장 수준)` : null,
      desiredCounts.essay ? `- 서술형(ESSAY): ${desiredCounts.essay}개 (서술/논술형, 채점 기준이나 핵심 포인트 포함)` : null
    ].filter(Boolean).join('\n');

    let context = '';
    let useRAG = false;

    // 파일이 선택된 경우: 임베딩 기반 RAG 사용
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      useRAG = true;

      // 의미론적 검색으로 관련 청크 가져오기
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

다음 학습 자료를 바탕으로 위 주제에 관한 총 ${totalQuestions}개의 문제를 생성해주세요.

**중요:** 학습 자료에 직접적인 내용이 없더라도, 위 주제와 관련된 문제를 반드시 포함해야 합니다.

학습 자료:
${context}

요구사항:
- 주제 "${quizTitle || '학습 자료'}"를 반드시 반영한 문제 생성
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제, 문제 풀이로 관련 내용을 정리할 수 있는 문제
- 총 ${totalQuestions}개의 문제 (학습 자료 기반 + 주제 관련)
- 타입별 문제 개수:
${typeRequirementText}
- MCQ 문제의 경우 선택지 4개(A,B,C,D)와 해설 포함, 정답은 A/B/C/D로 분산
- SHORT 문제의 경우 짧은 정답 텍스트와 해설 포함
- ESSAY 문제의 경우 서술형 답변을 평가할 수 있는 핵심 포인트나 채점 기준과 함께 해설 포함
- 난이도: ${difficultyText}

응답 형식 (JSON):
{
  "questions": [
    {
      "questionType": "MCQ",
      "question": "문제 내용",
      "optionA": "선택지 A",
      "optionB": "선택지 B",
      "optionC": "선택지 C",
      "optionD": "선택지 D",
      "correctAnswer": "A",
      "explanation": "해설 내용"
    },
    {
      "questionType": "SHORT",
      "question": "문제 내용",
      "correctAnswer": "정답 텍스트",
      "explanation": "해설 내용"
    },
    {
      "questionType": "ESSAY",
      "question": "문제 내용",
      "correctAnswer": "모범답안/핵심 포인트",
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

위 주제에 대한 총 ${totalQuestions}개의 문제를 생성해주세요.

요구사항:
- 주제 "${quizTitle}"와 관련된 실용적이고 교육적인 문제
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제, 문제 풀이로 관련 내용을 정리할 수 있는 문제
- 총 ${totalQuestions}개의 문제를 생성하고, 아래 타입별 개수를 반드시 맞추기
${typeRequirementText}
- MCQ 문제는 4개의 선택지 (A, B, C, D)를 가지며 정답을 A/B/C/D에 분산
- SHORT 문제는 짧은 정답 텍스트, ESSAY 문제는 서술형 답안을 평가할 포인트와 함께 제공
- 모든 오답 선택지는 그럴듯하고 비슷한 길이여야 함
- 난이도: ${difficultyText}
- 각 문제에 대한 상세한 해설 포함

응답 형식 (JSON):
{
  "questions": [
    {
      "questionType": "MCQ",
      "question": "문제 내용",
      "optionA": "선택지 A",
      "optionB": "선택지 B",
      "optionC": "선택지 C",
      "optionD": "선택지 D",
      "correctAnswer": "A",
      "explanation": "해설 내용"
    },
    {
      "questionType": "SHORT",
      "question": "문제 내용",
      "correctAnswer": "정답 텍스트",
      "explanation": "해설 내용"
    },
    {
      "questionType": "ESSAY",
      "question": "문제 내용",
      "correctAnswer": "모범답안/핵심 포인트",
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
4. 각 문제마다 명확한 해설을 제공해야 합니다
5. SHORT/ESSAY 문제도 JSON 형식에 맞게 명확한 정답 또는 채점 기준을 포함해야 합니다`
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

    const normalizedQuestions = normalizeQuestions(result.questions);
    const limitedQuestions = limitQuestionsByType(normalizedQuestions, desiredCounts);

    return NextResponse.json({
      questions: limitedQuestions
    });

  } catch (error) {
    console.error('AI 퀴즈 생성 실패:', error);
    return NextResponse.json(
      { error: error.message || 'AI 퀴즈 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
