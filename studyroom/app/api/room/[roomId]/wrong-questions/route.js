import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 강의실에서 많이 틀린 문제 조회
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { roomId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 강의실 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 멤버가 아닙니다' }, { status: 403 });
    }

    // 강의실의 모든 퀴즈 가져오기
    const { data: quizzes, error: quizError } = await supabase
      .from('Quiz')
      .select('QuizID')
      .eq('QuizRoomID', roomId);

    if (quizError || !quizzes || quizzes.length === 0) {
      return NextResponse.json({ wrongQuestions: [] });
    }

    const quizIds = quizzes.map(q => q.QuizID);

    // 강의실 멤버 수 조회
    const { data: members, error: memberError } = await supabase
      .from('RoomMember')
      .select('UserID')
      .eq('RoomID', roomId);

    if (memberError) {
      console.error('멤버 조회 오류:', memberError);
      return NextResponse.json({ error: '멤버 정보를 불러올 수 없습니다' }, { status: 500 });
    }

    const totalMembers = members.length;

    // 각 문제별 오답 통계 계산
    const { data: questions, error: questionError } = await supabase
      .from('Question')
      .select('*')
      .in('QuizID', quizIds);

    if (questionError || !questions) {
      console.error('문제 조회 오류:', questionError);
      return NextResponse.json({ error: '문제를 불러올 수 없습니다' }, { status: 500 });
    }

    // 각 문제에 대한 답변 통계 계산
    console.log('전체 문제 수:', questions.length);

    const wrongQuestionsWithStats = await Promise.all(
      questions.map(async (question) => {
        // 해당 문제의 모든 답변 조회 (QuizAttempt와 조인하여 UserID 가져오기)
        // AnswerID 기준 내림차순 정렬 (최신순)
        const { data: answers, error: answerError } = await supabase
          .from('Answer')
          .select(`
            AnswerID,
            isCorrect,
            AttemptID,
            QuizAttempt:AttemptID (
              UserID,
              AttemptID
            )
          `)
          .eq('QuestionID', question.QuestionID)
          .order('AnswerID', { ascending: false });

        if (answerError) {
          console.error('답변 조회 오류:', answerError);
          return null;
        }

        // 답변이 없는 문제는 제외
        if (!answers || answers.length === 0) {
          console.log(`문제 ${question.QuestionID}: 답변 없음`);
          return null;
        }

        // 디버깅: 정렬된 답변 출력 (이미 AnswerID 기준으로 정렬됨)
        console.log(`문제 ${question.QuestionID} 정렬된 답변:`, answers.map(a => ({
          answerID: a.AnswerID,
          userID: a.QuizAttempt?.UserID,
          isCorrect: a.isCorrect
        })));

        // 사용자별 가장 최근 답변만 추출 (AttemptID 기준 정렬 후 첫 번째)
        const userLatestAnswers = new Map();
        answers.forEach(answer => {
          const userId = answer.QuizAttempt?.UserID;
          if (userId && !userLatestAnswers.has(userId)) {
            userLatestAnswers.set(userId, answer);
          }
        });

        console.log(`문제 ${question.QuestionID} 사용자별 최근 답변:`, Array.from(userLatestAnswers.entries()).map(([userId, answer]) => ({
          userId,
          isCorrect: answer.isCorrect,
          answerID: answer.AnswerID
        })));

        const latestAnswers = Array.from(userLatestAnswers.values());
        const attemptCount = latestAnswers.length;

        // 최근 답변 기준으로 오답 수 계산
        const wrongCount = latestAnswers.filter(a => !a.isCorrect).length;

        console.log(`문제 ${question.QuestionID}: 전체 답변 ${answers.length}개, 고유 사용자 ${attemptCount}명, 최종 오답자 ${wrongCount}명`);

        // 오답률 계산 (최소 1명 이상 풀었을 때만)
        if (attemptCount < 1) {
          return null;
        }

        const wrongRate = (wrongCount / attemptCount) * 100;

        // 오답이 하나라도 있으면 포함
        if (wrongCount === 0) {
          console.log(`문제 ${question.QuestionID}: 모두 최종적으로 정답으로 제외`);
          return null;
        }

        console.log(`문제 ${question.QuestionID}: 포함! 오답률 ${wrongRate.toFixed(1)}%`);

        return {
          ...question,
          attemptCount,
          wrongCount,
          wrongRate: Math.round(wrongRate),
          totalMembers,
        };
      })
    );

    // null 제거 및 오답률 순으로 정렬
    const filteredQuestions = wrongQuestionsWithStats
      .filter(q => q !== null)
      .sort((a, b) => b.wrongRate - a.wrongRate)
      .slice(0, 10); // 상위 10개만

    console.log('필터링 후 많이 틀린 문제 수:', filteredQuestions.length);

    return NextResponse.json({ wrongQuestions: filteredQuestions });
  } catch (err) {
    console.error('많이 틀린 문제 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
