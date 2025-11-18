'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function GroupPage() {
  const params = useParams();
  const roomId = params.roomId;

  // 뷰 상태: 'main' | 'questions' | 'detail'
  const [view, setView] = useState('main');

  // 퀴즈 관련 상태
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // 댓글 관련 상태
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // 로딩 상태
  const [loading, setLoading] = useState(false);

  const commentEndRef = useRef(null);

  // 초기 로드: 퀴즈 목록 가져오기
  useEffect(() => {
    loadQuizzes();
    loadCurrentUser();
  }, [roomId]);

  // 퀴즈 목록 불러오기
  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/room/${roomId}/quiz`);
      const data = await res.json();

      if (res.ok) {
        setQuizzes(data.quizzes || []);
      } else {
        console.error('퀴즈 조회 실패:', data.error);
      }
    } catch (err) {
      console.error('퀴즈 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // 현재 사용자 정보 가져오기
  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/user/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('사용자 정보 조회 오류:', err);
    }
  };

  // 퀴즈의 문제 목록 불러오기
  const loadQuestions = async (quizId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quiz/${roomId}/${quizId}`);
      const data = await res.json();

      if (res.ok) {
        setQuestions(data.questions || []);
      } else {
        console.error('문제 조회 실패:', data.error);
      }
    } catch (err) {
      console.error('문제 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  // 문제의 댓글 불러오기
  const loadComments = async (questionId) => {
    try {
      const res = await fetch(`/api/question/${questionId}/comments`);
      const data = await res.json();

      if (res.ok) {
        setComments(data.comments || []);
      } else {
        console.error('댓글 조회 실패:', data.error);
      }
    } catch (err) {
      console.error('댓글 조회 오류:', err);
    }
  };

  // 댓글 추가
  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요');
      return;
    }

    try {
      const res = await fetch(`/api/question/${selectedQuestion.QuestionID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`댓글 추가 실패: ${data.error}`);
        return;
      }

      setNewComment('');
      loadComments(selectedQuestion.QuestionID);
    } catch (err) {
      console.error('댓글 추가 오류:', err);
      alert('댓글 추가에 실패했습니다');
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const res = await fetch(`/api/question/${selectedQuestion.QuestionID}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`댓글 삭제 실패: ${data.error}`);
        return;
      }

      loadComments(selectedQuestion.QuestionID);
    } catch (err) {
      console.error('댓글 삭제 오류:', err);
      alert('댓글 삭제에 실패했습니다');
    }
  };

  // 퀴즈 클릭 핸들러
  const handleQuizClick = (quiz) => {
    setSelectedQuiz(quiz);
    loadQuestions(quiz.QuizID);
    setView('questions');
  };

  // 문제 클릭 핸들러
  const handleQuestionClick = (question) => {
    setSelectedQuestion(question);
    loadComments(question.QuestionID);
    setView('detail');
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (view === 'detail') {
      setView('questions');
      setSelectedQuestion(null);
      setComments([]);
      setNewComment('');
    } else if (view === 'questions') {
      setView('main');
      setSelectedQuiz(null);
      setQuestions([]);
    }
  };

  // 댓글이 추가되면 스크롤
  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // 시간 포맷팅
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // === 메인 화면 ===
  if (view === 'main') {
    return (
      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* 왼쪽: 많이 틀린 문제 */}
        <div className="w-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            많이 틀린 문제
          </h2>
          <div className="text-gray-600 dark:text-gray-400 text-center py-12">
            <p className="text-lg mb-2">준비 중입니다</p>
            <p className="text-sm">강의실 멤버들이 많이 틀린 문제를 분석하여 표시합니다</p>
          </div>
        </div>

        {/* 오른쪽: 퀴즈 리스트 */}
        <div className="w-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            전체 퀴즈 리스트
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              ({quizzes.length})
            </span>
          </h2>

          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              로딩 중...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="text-lg mb-2">아직 퀴즈가 없습니다</p>
              <p className="text-sm">퀴즈 탭에서 퀴즈를 생성해보세요</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-18rem)]">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.QuizID}
                  onClick={() => handleQuizClick(quiz)}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                    {quiz.QuizTitle}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatTime(quiz.CreatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === 문제 리스트 화면 ===
  if (view === 'questions') {
    return (
      <div className="h-[calc(100vh-12rem)]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 h-full flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {selectedQuiz?.QuizTitle}
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({questions.length}문제)
              </span>
            </h2>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              뒤로가기
            </button>
          </div>

          {/* 문제 리스트 */}
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              로딩 중...
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p className="text-lg mb-2">문제가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1">
              {questions.map((question, index) => (
                <div
                  key={question.QuestionID}
                  onClick={() => handleQuestionClick(question)}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <p className="flex-1 text-gray-900 dark:text-white line-clamp-2">
                      {question.question}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === 문제 상세 화면 ===
  if (view === 'detail') {
    return (
      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* 왼쪽 섹션 */}
        <div className="w-1/2 flex flex-col gap-6">
          {/* 상단: 문제 및 보기 */}
          <div className="h-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                문제
              </h2>
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors text-sm"
              >
                뒤로가기
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-900 dark:text-white text-lg font-medium">
                {selectedQuestion?.question}
              </p>

              <div className="space-y-2">
                {['A', 'B', 'C', 'D'].map((option) => {
                  const optionText = selectedQuestion?.[`option${option}`];
                  if (!optionText) return null;

                  const isCorrect = selectedQuestion?.correctAnswer === option;

                  return (
                    <div
                      key={option}
                      className={`p-3 rounded-lg border-2 ${
                        isCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      <span className="font-semibold text-gray-900 dark:text-white mr-2">
                        {option}.
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {optionText}
                      </span>
                      {isCorrect && (
                        <span className="ml-2 text-green-600 dark:text-green-400 font-semibold">
                          정답
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedQuestion?.explanation && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                  <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    해설
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {selectedQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 하단: 댓글 */}
          <div className="h-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                댓글
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({comments.length})
                </span>
              </h2>
            </div>

            {/* 댓글 목록 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p className="text-lg mb-2">아직 댓글이 없습니다</p>
                  <p className="text-sm">첫 번째 댓글을 작성해보세요!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.CommentId}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                          {comment.User?.name?.[0] || '?'}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {comment.User?.name || '알 수 없음'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(comment.TypeTime)}
                          </p>
                        </div>
                      </div>
                      {currentUser && comment.UserID === currentUser.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.CommentId)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap ml-10">
                      {comment.Comment}
                    </p>
                  </div>
                ))
              )}
              <div ref={commentEndRef} />
            </div>

            {/* 댓글 작성 폼 */}
            <form onSubmit={handleAddComment} className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                >
                  전송
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 오른쪽: AI 챗봇 */}
        <div className="w-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            AI 학습 도우미
          </h2>
          <div className="text-gray-600 dark:text-gray-400 text-center py-12">
            <p className="text-lg mb-2">준비 중입니다</p>
            <p className="text-sm mb-4">AI가 이 문제에 대해 도움을 줄 예정입니다</p>
            <div className="space-y-2 text-left max-w-md mx-auto">
              <p className="text-sm">• 문제 풀이 힌트 제공</p>
              <p className="text-sm">• 추가 설명</p>
              <p className="text-sm">• 유사 문제 추천</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
