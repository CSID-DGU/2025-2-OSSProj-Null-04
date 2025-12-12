import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

// POST /api/quiz/create - 퀴즈 생성 (수동 문제 + AI 생성 문제)
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const {
      roomId,
      quizTitle,
      questions, // [{ question, optionA, optionB, optionC, optionD, correctAnswer, explanation }]
      fileIds // 퀴즈 출처 파일들
    } = await request.json();

    if (!roomId || !quizTitle || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: '필수 정보를 입력해주세요' }, { status: 400 });
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

    // 퀴즈 생성
    const { data: quiz, error: quizError } = await supabase
      .from('Quiz')
      .insert({
        QuizTitle: quizTitle,
        QuizRoomID: roomId
      })
      .select()
      .single();

    if (quizError) throw quizError;

    // 문제 생성
    const questionRecords = questions.map(q => {
      const qtRaw = q.questionType || 'MCQ';
      const qtNormalized =
        qtRaw.toUpperCase() === 'MCQ'
          ? 'MCQ'
          : qtRaw.toLowerCase() === 'short'
            ? 'short'
            : qtRaw.toLowerCase() === 'essay'
              ? 'essay'
              : 'MCQ';

      return {
        question: q.question,
        optionA: q.optionA || null,
        optionB: q.optionB || null,
        optionC: q.optionC || null,
        optionD: q.optionD || null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || null,
        questionType: qtNormalized,
        QuizID: quiz.QuizID
      };
    });

    const { error: questionsError } = await supabase
      .from('Question')
      .insert(questionRecords);

    if (questionsError) throw questionsError;

    // 출처 파일 저장 (선택사항)
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const sourceFileRecords = fileIds.map(fileId => ({
        QuizID: quiz.QuizID,
        FileID: fileId
      }));

      await supabase
        .from('QuizSourceFiles')
        .insert(sourceFileRecords);
    }

    return NextResponse.json({
      success: true,
      quizId: quiz.QuizID,
      message: '퀴즈가 생성되었습니다'
    });

  } catch (error) {
    console.error('퀴즈 생성 실패:', error);
    return NextResponse.json(
      { error: error.message || '퀴즈 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
