import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/quiz/[roomId]/[quizId] - 퀴즈 문제 조회
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomId, quizId } = await params;
    const supabase = await createClient();

    // 해당 강의실의 멤버인지 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 접근 권한이 없습니다' }, { status: 403 });
    }

    // 퀴즈 정보 조회
    const { data: quiz, error: quizError } = await supabase
      .from('Quiz')
      .select('QuizID, QuizTitle, QuizRoomID')
      .eq('QuizID', quizId)
      .eq('QuizRoomID', roomId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: '퀴즈를 찾을 수 없습니다' }, { status: 404 });
    }

    // 문제 목록 조회
    const { data: questions, error: questionsError } = await supabase
      .from('Question')
      .select('QuestionID, question, optionA, optionB, optionC, optionD, correctAnswer, explanation, questionType')
      .eq('QuizID', quizId)
      .order('QuestionID', { ascending: true });

    if (questionsError) throw questionsError;

    return NextResponse.json({
      quiz: {
        QuizID: quiz.QuizID,
        QuizTitle: quiz.QuizTitle
      },
      questions: questions || []
    });
  } catch (error) {
    console.error('퀴즈 조회 실패:', error);
    return NextResponse.json(
      { error: '퀴즈를 불러오는데 실패했습니다' },
      { status: 500 }
    );
  }
}

// DELETE /api/quiz/[roomId]/[quizId] - 퀴즈 삭제
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { roomId, quizId } = await params ?? {};
    if (!roomId || !quizId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 강의실 멤버 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '강의실 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 퀴즈 존재 확인
    const { data: quiz } = await supabase
      .from('Quiz')
      .select('QuizID')
      .eq('QuizID', quizId)
      .eq('QuizRoomID', roomId)
      .single();

    if (!quiz) {
      return NextResponse.json(
        { error: '퀴즈를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 문제 ID 수집 (댓글/챗 세션 정리용)
    const { data: questionRows, error: questionsFetchError } = await supabase
      .from('Question')
      .select('QuestionID')
      .eq('QuizID', quizId);

    if (questionsFetchError) {
      throw questionsFetchError;
    }

    const questionIds = (questionRows || []).map(q => q.QuestionID);

    // 문제별 댓글 삭제
    if (questionIds.length > 0) {
      const { error: commentsDeleteError } = await supabase
        .from('comment')
        .delete()
        .in('QuestionID', questionIds);

      if (commentsDeleteError) {
        throw commentsDeleteError;
      }
    }

    // 문제별 챗 세션/메시지 삭제
    let sessionIds = [];
    if (questionIds.length > 0) {
      const { data: sessions, error: sessionsFetchError } = await supabase
        .from('chat_sessions')
        .select('SessionID')
        .in('QuestionID', questionIds);

      if (sessionsFetchError) {
        throw sessionsFetchError;
      }

      sessionIds = (sessions || []).map(s => s.SessionID);

      if (sessionIds.length > 0) {
        const { error: chatMessagesDeleteError } = await supabase
          .from('chat_messages')
          .delete()
          .in('SessionID', sessionIds);

        if (chatMessagesDeleteError) {
          throw chatMessagesDeleteError;
        }
      }

      const { error: chatSessionsDeleteError } = await supabase
        .from('chat_sessions')
        .delete()
        .in('QuestionID', questionIds);

      if (chatSessionsDeleteError) {
        throw chatSessionsDeleteError;
      }
    }

    // 퀴즈 관련 데이터 정리 (응답 -> 시도 -> 출처 파일 -> 문제 -> 퀴즈)
    const { data: attempts, error: attemptsFetchError } = await supabase
      .from('QuizAttempt')
      .select('AttemptID')
      .eq('QuizID', quizId);

    if (attemptsFetchError) {
      throw attemptsFetchError;
    }

    const attemptIds = (attempts || []).map(a => a.AttemptID);

    if (attemptIds.length > 0) {
      const { error: answersDeleteError } = await supabase
        .from('Answer')
        .delete()
        .in('AttemptID', attemptIds);

      if (answersDeleteError) {
        throw answersDeleteError;
      }
    }

    const { error: attemptsDeleteError } = await supabase
      .from('QuizAttempt')
      .delete()
      .eq('QuizID', quizId);

    if (attemptsDeleteError) {
      throw attemptsDeleteError;
    }

    const { error: sourceDeleteError } = await supabase
      .from('QuizSourceFiles')
      .delete()
      .eq('QuizID', quizId);

    if (sourceDeleteError) {
      throw sourceDeleteError;
    }

    const { error: questionDeleteError } = await supabase
      .from('Question')
      .delete()
      .eq('QuizID', quizId);

    if (questionDeleteError) {
      throw questionDeleteError;
    }

    const { error: quizDeleteError } = await supabase
      .from('Quiz')
      .delete()
      .eq('QuizID', quizId)
      .eq('QuizRoomID', roomId);

    if (quizDeleteError) {
      throw quizDeleteError;
    }

    return NextResponse.json(
      { success: true, message: '퀴즈가 삭제되었습니다' },
      { status: 200 }
    );
  } catch (error) {
    console.error('퀴즈 삭제 실패:', error);
    return NextResponse.json(
      { error: '퀴즈 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}
