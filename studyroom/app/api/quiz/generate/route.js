import { getCurrentUser, checkRoomMembership } from '@/lib/auth';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRelevantChunks } from '@/lib/vectorize/semanticSearch';
import { createClient } from '@/lib/supabase/server';

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

    const remainingTotal = quotas.MCQ + quotas.short + quotas.essay - (usage.MCQ + usage.short + usage.essay);
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

    const { fileIds, questionCounts, questionCount, difficulty, quizTitle, roomId } = await request.json();
    const desiredCounts = normalizeQuestionCounts(questionCounts, questionCount);
    const totalQuestions = desiredCounts.mcq + desiredCounts.short + desiredCounts.essay;

    if (totalQuestions <= 0) {
      return NextResponse.json({ error: '문제 수를 1개 이상 입력해주세요' }, { status: 400 });
    }

    // roomId를 통해 멤버십 확인 (roomId는 클라이언트에서 전달받거나 fileIds로 파악)
    let targetRoomId = roomId;

    // roomId가 없으면 fileIds를 통해 파악
    if (!targetRoomId && fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const supabase = await createClient();
      const { data: file } = await supabase
        .from('File')
        .select('RoomID')
        .eq('FileID', fileIds[0])
        .single();
      targetRoomId = file?.RoomID;
    }

    if (!targetRoomId) {
      return NextResponse.json({ error: '강의실 정보를 찾을 수 없습니다' }, { status: 400 });
    }

    // 멤버십 및 권한 확인
    const membership = await checkRoomMembership(targetRoomId, user.id);
    if (!membership) {
      return NextResponse.json({ error: '강의실 접근 권한이 없습니다' }, { status: 403 });
    }

    // 게스트는 퀴즈 생성 불가
    if (membership.Role === 'guest') {
      return NextResponse.json({ error: '게스트는 퀴즈를 생성할 수 없습니다' }, { status: 403 });
    }

    // 모든 파일이 같은 강의실에 속하는지 확인
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const supabase = await createClient();
      const { data: files } = await supabase
        .from('File')
        .select('RoomID')
        .in('FileID', fileIds);

      if (!files || files.length !== fileIds.length) {
        return NextResponse.json({ error: '일부 파일을 찾을 수 없습니다' }, { status: 400 });
      }

      const allSameRoom = files.every(f => f.RoomID === targetRoomId);
      if (!allSameRoom) {
        return NextResponse.json({ error: '모든 파일이 같은 강의실에 속해야 합니다' }, { status: 400 });
      }
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

학습 자료:
${context}

**중요한 문제 작성 원칙:**
1. **문제는 반드시 자기완결적이어야 합니다**
   - 문제만 보고도 풀 수 있어야 함
   - 필요한 모든 정보를 문제 내에 포함
   - "자료에서", "참고 자료에 따르면" 등의 표현 금지
   
2. **구체적인 정보 제공**
   - 추상적인 질문 대신 구체적인 상황/데이터 제시
   - 예: "~~는 어떻게 구현했을까요?" (X)
   - 예: "다음 코드에서 사용된 알고리즘은?" (O, 코드 포함)

3. **해설 작성 가이드**
   - "자료에 표시된 대로", "참고 자료의" 등의 표현 사용 금지
   - 개념과 원리를 직접 설명
   - 왜 그 답이 맞는지 명확히 설명

4. **객관식 문제 작성 규칙 (매우 중요!)**
   - question 필드: 질문 내용만 작성 (선택지 포함하지 않음)
   - 선택지는 반드시 optionA, optionB, optionC, optionD 필드에 분리
   - 잘못된 예: question에 "A. 답1 B. 답2 ..." 포함
   - 올바른 예: question은 질문만, optionA="답1", optionB="답2"로 분리

요구사항:
- 주제 "${quizTitle || '학습 자료'}"를 반드시 반영한 문제 생성
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제
- 총 ${totalQuestions}개의 문제
- 타입별 문제 개수:
${typeRequirementText}
- MCQ: 선택지 4개(A,B,C,D), 정답은 A/B/C/D로 고르게 분산
- SHORT: 짧고 명확한 정답
- ESSAY: 핵심 개념을 평가하는 모범답안
- 난이도: ${difficultyText}

응답 형식 (JSON):
{
  "questions": [
    {
      "questionType": "MCQ",
      "question": "자기완결적인 질문 내용만 작성 (선택지는 절대 포함하지 않음)",
      "optionA": "첫 번째 선택지",
      "optionB": "두 번째 선택지",
      "optionC": "세 번째 선택지",
      "optionD": "네 번째 선택지",
      "correctAnswer": "A",
      "explanation": "개념을 직접 설명하는 해설 (참고자료 언급 없이)"
    },
    {
      "questionType": "SHORT",
      "question": "자기완결적인 문제 내용",
      "correctAnswer": "정답 텍스트",
      "explanation": "개념 직접 설명"
    },
    {
      "questionType": "ESSAY",
      "question": "자기완결적인 문제 내용",
      "correctAnswer": "모범답안/핵심 포인트",
      "explanation": "개념 직접 설명"
    }
  ]
}`;
    } else {
      // 주제 기반 퀴즈 생성 (파일 없음)
      if (!quizTitle || !quizTitle.trim()) {
        return NextResponse.json({ error: '퀴즈 제목을 입력해주세요' }, { status: 400 });
      }

      userPrompt = `주제: "${quizTitle}"

위 주제에 대한 총 ${totalQuestions}개의 자기완결적인 문제를 생성해주세요.

**중요한 문제 작성 원칙:**
1. **문제는 반드시 자기완결적이어야 합니다**
   - 문제만 보고도 풀 수 있어야 함
   - 필요한 모든 정보를 문제 내에 포함
   
2. **구체적인 정보 제공**
   - 추상적인 질문 대신 구체적인 상황/데이터 제시
   
3. **해설은 개념을 직접 설명**
   - 왜 그 답이 맞는지 명확히 설명

4. **객관식 문제 작성 규칙 (매우 중요!)**
   - question 필드: 질문 내용만 작성 (선택지 포함하지 않음)
   - 선택지는 반드시 optionA, optionB, optionC, optionD 필드에 분리
   - 잘못된 예: question에 "A. 답1 B. 답2 ..." 포함
   - 올바른 예: question은 질문만, optionA="답1", optionB="답2"로 분리

요구사항:
- 주제 "${quizTitle}"와 관련된 실용적이고 교육적인 문제
- **시험에 나올 만한 문제**, 문제 풀이로 원리를 이해할 수 있는 문제
- 총 ${totalQuestions}개의 문제를 생성하고, 아래 타입별 개수를 반드시 맞추기
${typeRequirementText}
- MCQ: 4개 선택지 (A, B, C, D), 정답을 A/B/C/D에 고르게 분산
- SHORT: 짧고 명확한 정답
- ESSAY: 핵심 개념을 평가하는 모범답안
- 모든 오답 선택지는 그럴듯하고 비슷한 길이여야 함
- 난이도: ${difficultyText}
- 각 문제에 대한 상세한 해설 포함

응답 형식 (JSON):
{
  "questions": [
    {
      "questionType": "MCQ",
      "question": "자기완결적인 문제 내용",
      "optionA": "선택지 A",
      "optionB": "선택지 B",
      "optionC": "선택지 C",
      "optionD": "선택지 D",
      "correctAnswer": "A",
      "explanation": "개념을 직접 설명하는 해설"
    },
    {
      "questionType": "SHORT",
      "question": "자기완결적인 문제 내용",
      "correctAnswer": "정답 텍스트",
      "explanation": "개념 직접 설명"
    },
    {
      "questionType": "ESSAY",
      "question": "자기완결적인 문제 내용",
      "correctAnswer": "모범답안/핵심 포인트",
      "explanation": "개념 직접 설명"
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
