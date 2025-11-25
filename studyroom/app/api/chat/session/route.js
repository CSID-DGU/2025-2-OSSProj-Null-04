import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// POST: 세션 조회 또는 생성 + 메시지 히스토리 반환
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { questionId } = await request.json();

    if (!questionId) {
      return Response.json({ error: 'questionId가 필요합니다' }, { status: 400 });
    }

    const supabase = await createClient();

    // 기존 세션 조회
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('SessionID, started_at')
      .eq('UserID', user.id)
      .eq('QuestionID', questionId)
      .single();

    let session = existingSession;

    // 세션이 없으면 새로 생성
    if (!session) {
      const { data: newSession, error: createError } = await supabase
        .from('chat_sessions')
        .insert({
          UserID: user.id,
          QuestionID: questionId,
        })
        .select('SessionID, started_at')
        .single();

      if (createError) {
        console.error('세션 생성 오류:', createError);
        return Response.json({ error: '세션 생성에 실패했습니다' }, { status: 500 });
      }

      session = newSession;
    }

    // 메시지 히스토리 조회
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('AI_chatID, sender, message, created_at')
      .eq('SessionID', session.SessionID)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('메시지 조회 오류:', messagesError);
      return Response.json({ error: '메시지 조회에 실패했습니다' }, { status: 500 });
    }

    return Response.json({
      session: {
        sessionId: session.SessionID,
        startedAt: session.started_at,
      },
      messages: messages || [],
    });

  } catch (error) {
    console.error('세션 API 오류:', error);
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
