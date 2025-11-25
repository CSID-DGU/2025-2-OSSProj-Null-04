import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    const supabase = await createClient();

    // 난이도별 프롬프트 조정
    const difficultyMap = {
      easy: '쉬운',
      medium: '보통',
      hard: '어려운'
    };
    const difficultyText = difficultyMap[difficulty] || '보통';

    let context = '';
    let useRAG = false;

    // 파일이 선택된 경우: RAG 사용
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      useRAG = true;

      // 파일의 청크 데이터 가져오기
      const { data: chunks, error: chunksError } = await supabase
        .from('FileChunk')
        .select('ChunkText, ChunkMetadata')
        .in('FileID', fileIds)
        .order('FileID', { ascending: true })
        .order('ChunkIndex', { ascending: true });

      if (chunksError) throw chunksError;

      if (!chunks || chunks.length === 0) {
        return NextResponse.json({ error: '선택한 파일에 처리된 내용이 없습니다' }, { status: 400 });
      }

      // 청크를 하나의 컨텍스트로 결합 (토큰 제한 고려)
      context = chunks.map(chunk => chunk.ChunkText).join('\n\n');
      const maxContextLength = 8000; // 안전한 토큰 제한
      context = context.length > maxContextLength
        ? context.substring(0, maxContextLength) + '...'
        : context;
    }

    // OpenAI API 호출
    let userPrompt;

    if (useRAG) {
      // 파일 기반 퀴즈 생성 (RAG)
      userPrompt = `다음 학습 자료를 바탕으로 ${questionCount}개의 객관식 문제를 생성해주세요.

학습 자료:
${context}

요구사항:
- 총 ${questionCount}개의 문제를 생성
- 각 문제는 4개의 선택지 (A, B, C, D)를 가짐
- 난이도: ${difficultyText}
- 각 문제에 대한 해설 포함
- 정답은 A, B, C, D 중 하나

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

      userPrompt = `"${quizTitle}"에 대한 ${questionCount}개의 객관식 문제를 생성해주세요.

요구사항:
- 총 ${questionCount}개의 문제를 생성
- 각 문제는 4개의 선택지 (A, B, C, D)를 가짐
- 난이도: ${difficultyText}
- 각 문제에 대한 해설 포함
- 정답은 A, B, C, D 중 하나
- 주제와 관련된 실용적이고 교육적인 문제를 생성

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
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 교육용 퀴즈를 생성하는 AI입니다. ${difficultyText} 난이도의 객관식 문제를 생성해주세요.`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
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
