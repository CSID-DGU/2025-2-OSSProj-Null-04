import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import openai, { getQuestionHelperSystemPrompt } from '@/lib/openai';

// POST: 메시지 전송 + 스트리밍 응답
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { sessionId, questionId, message } = await request.json();

    if (!sessionId || !questionId || !message) {
      return Response.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 });
    }

    const supabase = await createClient();

    // 문제 정보 조회
    const { data: question, error: questionError } = await supabase
      .from('Question')
      .select('QuestionID, question, optionA, optionB, optionC, optionD, correctAnswer, explanation')
      .eq('QuestionID', questionId)
      .single();

    if (questionError || !question) {
      return Response.json({ error: '문제를 찾을 수 없습니다' }, { status: 404 });
    }

    // 사용자 메시지 저장
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        SessionID: sessionId,
        sender: 'User',
        message: message,
      });

    if (userMsgError) {
      console.error('사용자 메시지 저장 오류:', userMsgError);
      return Response.json({ error: '메시지 저장에 실패했습니다' }, { status: 500 });
    }

    // 대화 히스토리 조회 (최근 10개)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('sender, message')
      .eq('SessionID', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    // OpenAI 메시지 배열 구성
    const messages = [
      { role: 'system', content: getQuestionHelperSystemPrompt(question) },
      ...(history || []).map(msg => ({
        role: msg.sender === 'User' ? 'user' : 'assistant',
        content: msg.message,
      })),
    ];

    // OpenAI 스트리밍 호출
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      max_tokens: 1000,
    });

    // 전체 응답을 수집할 변수
    let fullResponse = '';

    // TransformStream을 사용하여 스트림 처리
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              // SSE 형식으로 전송
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          // 스트림 완료 후 AI 응답 DB 저장
          if (fullResponse) {
            await supabase
              .from('chat_messages')
              .insert({
                SessionID: sessionId,
                sender: 'AI',
                message: fullResponse,
              });
          }

          // 스트림 종료 신호
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('스트리밍 오류:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('메시지 API 오류:', error);
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
