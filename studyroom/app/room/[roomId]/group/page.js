'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function GroupPage() {
  const params = useParams();
  const roomId = params.roomId;
  const queryClient = useQueryClient();

  // 뷰 상태: 'main' | 'questions' | 'detail' | 'retry'
  const [view, setView] = useState('main');

  // 퀴즈 관련 상태
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // 댓글 관련 상태
  const [newComment, setNewComment] = useState('');

  // 재풀이 모드 관련 상태
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // AI 챗봇 관련 상태
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [chatSessionLoading, setChatSessionLoading] = useState(false);

  // 리사이저 상태
  const [leftWidth, setLeftWidth] = useState(50); // 왼쪽 섹션 너비 비율 (%)
  const [questionHeight, setQuestionHeight] = useState(55); // 문제 섹션 높이 비율 (%)
  const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const containerRef = useRef(null);
  const leftSectionRef = useRef(null);

  const commentEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // 퀴즈 목록 조회 (useQuery)
  const { data: quizzes = [], isLoading: loading } = useQuery({
    queryKey: ['quizzes', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/quiz`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 조회 실패');
      }

      return data.quizzes || [];
    },
    enabled: !!roomId,
    staleTime: 2 * 60 * 1000, // 2분
  });

  // 많이 틀린 문제 조회 (useQuery)
  const { data: wrongQuestions = [], isLoading: wrongQuestionsLoading, refetch: refetchWrongQuestions } = useQuery({
    queryKey: ['wrongQuestions', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/wrong-questions`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '많이 틀린 문제 조회 실패');
      }

      return data.wrongQuestions || [];
    },
    enabled: !!roomId,
    staleTime: 60 * 1000, // 1분
  });

  // 현재 사용자 정보 조회 (useQuery)
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const res = await fetch('/api/user/me');
      if (!res.ok) {
        throw new Error('사용자 정보 조회 실패');
      }
      const data = await res.json();
      return data.user;
    },
    staleTime: 10 * 60 * 1000, // 10분
  });

  // 문제 목록 상태 (동적 로드)
  const [questions, setQuestions] = useState([]);

  // 퀴즈의 문제 목록 불러오기
  const loadQuestions = async (quizId) => {
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
    }
  };

  // 댓글 조회 (useQuery with polling)
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', selectedQuestion?.QuestionID],
    queryFn: async () => {
      if (!selectedQuestion?.QuestionID) return [];

      const res = await fetch(`/api/question/${selectedQuestion.QuestionID}/comments`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 조회 실패');
      }

      return data.comments || [];
    },
    enabled: !!selectedQuestion?.QuestionID,
    refetchInterval: 3000, // 3초마다 폴링
    staleTime: 2000, // 2초
  });

  // AI 챗봇 세션 로드
  const loadChatSession = async (questionId) => {
    setChatSessionLoading(true);
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });

      const data = await res.json();

      if (res.ok) {
        setChatSessionId(data.session.sessionId);
        setChatMessages(data.messages || []);
      } else {
        console.error('채팅 세션 로드 실패:', data.error);
      }
    } catch (err) {
      console.error('채팅 세션 로드 오류:', err);
    } finally {
      setChatSessionLoading(false);
    }
  };

  // AI 챗봇 메시지 전송 (스트리밍)
  const handleSendChatMessage = async (e) => {
    e.preventDefault();

    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    setStreamingMessage('');

    // 사용자 메시지 즉시 표시
    setChatMessages(prev => [...prev, {
      AI_chatID: Date.now(),
      sender: 'User',
      message: userMessage,
      created_at: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: chatSessionId,
          questionId: selectedQuestion.QuestionID,
          message: userMessage,
        }),
      });

      if (!res.ok) {
        throw new Error('메시지 전송 실패');
      }

      // 스트리밍 응답 처리
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // 스트리밍 완료 - 전체 메시지를 채팅 목록에 추가
              setChatMessages(prev => [...prev, {
                AI_chatID: Date.now() + 1,
                sender: 'AI',
                message: fullMessage,
                created_at: new Date().toISOString(),
              }]);
              setStreamingMessage('');
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullMessage += parsed.content;
                  setStreamingMessage(fullMessage);
                }
              } catch (e) {
                // JSON 파싱 실패 무시
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('메시지 전송 오류:', err);
      alert('메시지 전송에 실패했습니다');
    } finally {
      setChatLoading(false);
    }
  };

  // 댓글 추가 Mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ questionId, comment }) => {
      const res = await fetch(`/api/question/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 추가 실패');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // 댓글 쿼리 무효화하여 즉시 새로고침
      queryClient.invalidateQueries({ queryKey: ['comments', variables.questionId] });
      setNewComment('');
    },
    onError: (error) => {
      console.error('댓글 추가 오류:', error);
      alert(`댓글 추가 실패: ${error.message}`);
    },
  });

  // 댓글 추가 핸들러
  const handleAddComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요');
      return;
    }

    addCommentMutation.mutate({
      questionId: selectedQuestion.QuestionID,
      comment: newComment,
    });
  };

  // 댓글 삭제 Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ questionId, commentId }) => {
      const res = await fetch(`/api/question/${questionId}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '댓글 삭제 실패');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // 댓글 쿼리 무효화하여 즉시 새로고침
      queryClient.invalidateQueries({ queryKey: ['comments', variables.questionId] });
    },
    onError: (error) => {
      console.error('댓글 삭제 오류:', error);
      alert(`댓글 삭제 실패: ${error.message}`);
    },
  });

  // 댓글 삭제 핸들러
  const handleDeleteComment = async (commentId) => {
    if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) {
      return;
    }

    deleteCommentMutation.mutate({
      questionId: selectedQuestion.QuestionID,
      commentId,
    });
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
    loadChatSession(question.QuestionID);
    setChatMessages([]);
    setStreamingMessage('');
    setView('detail');
  };

  // 많이 틀린 문제 클릭 핸들러 (재풀이 모드)
  const handleWrongQuestionClick = (question) => {
    setSelectedQuestion(question);
    setSelectedAnswer(null);
    setShowResult(false);
    setView('retry');
  };

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (view === 'detail') {
      setView('questions');
      setSelectedQuestion(null);
      setNewComment('');
      // 채팅 상태 초기화
      setChatSessionId(null);
      setChatMessages([]);
      setChatInput('');
      setStreamingMessage('');
    } else if (view === 'questions') {
      setView('main');
      setSelectedQuiz(null);
      setQuestions([]);
    } else if (view === 'retry') {
      setView('main');
      setSelectedQuestion(null);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  // 답안 선택 핸들러
  const handleAnswerSelect = (option) => {
    if (!showResult) {
      setSelectedAnswer(option);
    }
  };

  // 답안 제출 핸들러
  const handleSubmitAnswer = async () => {
    if (!selectedAnswer) {
      alert('답을 선택해주세요');
      return;
    }

    try {
      // 재풀이 답변 제출 API 호출
      const res = await fetch(`/api/question/${selectedQuestion.QuestionID}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswer: selectedAnswer }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowResult(true);
        // 정답을 맞췄다면 많이 틀린 문제 목록 새로고침
        if (data.isCorrect) {
          setTimeout(() => {
            refetchWrongQuestions();
          }, 1000);
        }
      } else {
        console.error('답변 제출 실패:', data.error);
        alert('답변 제출에 실패했습니다');
      }
    } catch (err) {
      console.error('답변 제출 오류:', err);
      alert('답변 제출 중 오류가 발생했습니다');
    }
  };

  // 댓글이 추가되면 스크롤
  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // 채팅 메시지가 추가되면 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

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

  // 수평 리사이저 핸들러 (왼쪽/오른쪽 너비 조절)
  const handleHorizontalMouseDown = (e) => {
    e.preventDefault();
    setIsResizingHorizontal(true);
  };

  // 수직 리사이저 핸들러 (문제/댓글 높이 조절)
  const handleVerticalMouseDown = (e) => {
    e.preventDefault();
    setIsResizingVertical(true);
  };

  // 마우스 이동 및 해제 이벤트
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingHorizontal && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        setLeftWidth(Math.min(Math.max(newWidth, 25), 75)); // 25% ~ 75% 제한
      }
      if (isResizingVertical && leftSectionRef.current) {
        const sectionRect = leftSectionRef.current.getBoundingClientRect();
        const newHeight = ((e.clientY - sectionRect.top) / sectionRect.height) * 100;
        setQuestionHeight(Math.min(Math.max(newHeight, 20), 80)); // 20% ~ 80% 제한
      }
    };

    const handleMouseUp = () => {
      setIsResizingHorizontal(false);
      setIsResizingVertical(false);
    };

    if (isResizingHorizontal || isResizingVertical) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingHorizontal, isResizingVertical]);

  // === 메인 화면 ===
  if (view === 'main') {
    return (
      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* 왼쪽: 많이 틀린 문제 */}
        <div className="w-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                많이 틀린 문제
              </h2>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {wrongQuestions.length}개
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {wrongQuestionsLoading ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-12">
                <p>로딩 중...</p>
              </div>
            ) : wrongQuestions.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center py-12">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium mb-1">많이 틀린 문제가 없습니다</p>
                <p className="text-sm">그룹원들이 퀴즈를 풀면 통계가 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wrongQuestions.map((question, index) => {
                  const correctRate = 100 - question.wrongRate;
                  // 정답률에 따른 색상: 높을수록 초록색, 낮을수록 빨간색
                  const getGradientColor = () => {
                    if (correctRate >= 70) return 'from-green-500 to-green-600'; // 정답률 70%+
                    if (correctRate >= 50) return 'from-yellow-400 to-yellow-500'; // 정답률 50-70%
                    if (correctRate >= 30) return 'from-orange-400 to-orange-500'; // 정답률 30-50%
                    return 'from-red-500 to-red-600'; // 정답률 30%-
                  };
                  const getBarColor = () => {
                    if (correctRate >= 70) return 'bg-green-500';
                    if (correctRate >= 50) return 'bg-yellow-500';
                    if (correctRate >= 30) return 'bg-orange-500';
                    return 'bg-red-500';
                  };
                  const getTextColor = () => {
                    if (correctRate >= 70) return 'text-green-600 dark:text-green-400';
                    if (correctRate >= 50) return 'text-yellow-600 dark:text-yellow-400';
                    if (correctRate >= 30) return 'text-orange-600 dark:text-orange-400';
                    return 'text-red-600 dark:text-red-400';
                  };
                  return (
                    <div
                      key={question.QuestionID}
                      onClick={() => handleWrongQuestionClick(question)}
                      className="group bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer transition-all duration-200 border border-transparent hover:border-red-200 dark:hover:border-red-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 bg-gradient-to-br ${getGradientColor()} text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white line-clamp-2 text-sm leading-relaxed mb-2">
                            {question.question}
                          </p>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                              {question.quizTitle || '퀴즈'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">정답률:</span>
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getBarColor()}`}
                                  style={{ width: `${correctRate}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-semibold ${getTextColor()}`}>
                                {correctRate}%
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {question.attemptCount}명 응답
                            </span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-red-400 transition-colors flex-shrink-0 self-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 퀴즈 리스트 */}
        <div className="w-1/2 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                전체 퀴즈 리스트
              </h2>
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                {quizzes.length}개
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <p>로딩 중...</p>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="font-medium mb-1">아직 퀴즈가 없습니다</p>
                <p className="text-sm">퀴즈 탭에서 퀴즈를 생성해보세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.QuizID}
                    onClick={() => handleQuizClick(quiz)}
                    className="group bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:bg-primary-50 dark:hover:bg-primary-900/10 cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {quiz.QuizTitle}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatTime(quiz.CreatedAt)}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === 문제 리스트 화면 ===
  if (view === 'questions') {
    return (
      <div className="h-[calc(100vh-12rem)]">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg h-full flex flex-col">
          {/* 헤더 */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedQuiz?.QuizTitle}
                </h2>
              </div>
              {!loading && (
                <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {questions.length}문제
                </span>
              )}
            </div>
          </div>

          {/* 문제 리스트 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <p>로딩 중...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium mb-1">문제가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div
                    key={question.QuestionID}
                    onClick={() => handleQuestionClick(question)}
                    className="group bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:bg-primary-50 dark:hover:bg-primary-900/10 cursor-pointer transition-all duration-200 border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 border-2 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-400 rounded-lg flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <p className="flex-1 text-gray-900 dark:text-white line-clamp-2 text-sm">
                        {question.question}
                      </p>
                      <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === 문제 상세 화면 ===
  if (view === 'detail') {
    return (
      <div ref={containerRef} className="h-[calc(100vh-10rem)] flex">
        {/* 왼쪽 섹션 */}
        <div ref={leftSectionRef} className="flex flex-col" style={{ width: `${leftWidth}%` }}>
          {/* 상단: 문제 및 보기 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col" style={{ height: `${questionHeight}%` }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                문제
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-gray-900 dark:text-white font-medium">
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
                      className={`p-2.5 rounded-lg border-2 text-sm ${isCorrect
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
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                  <p className="font-semibold text-blue-900 dark:text-blue-300 mb-1 text-sm">
                    해설
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {selectedQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 수직 리사이저 (문제/댓글 사이) */}
          <div
            className="h-2 cursor-row-resize flex items-center justify-center group"
            onMouseDown={handleVerticalMouseDown}
          >
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-primary-400 transition-colors"></div>
          </div>

          {/* 하단: 댓글 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col flex-1 min-h-0">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                댓글
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({comments.length})
                </span>
              </h2>
            </div>

            {/* 댓글 목록 - 말풍선 스타일 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsLoading ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  <p className="text-sm">로딩 중...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  <p className="text-sm">아직 댓글이 없습니다</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isMyComment = currentUser && comment.UserID === currentUser.id;
                  return (
                    <div
                      key={comment.CommentId}
                      className={`flex ${isMyComment ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] ${isMyComment ? 'order-2' : ''}`}>
                        {/* 이름 + 시간 */}
                        <div className={`flex items-center gap-2 mb-1 ${isMyComment ? 'justify-end' : ''}`}>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {comment.User?.name || '알 수 없음'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatTime(comment.TypeTime)}
                          </span>
                          {isMyComment && (
                            <button
                              onClick={() => handleDeleteComment(comment.CommentId)}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                        {/* 말풍선 */}
                        <div
                          className={`p-2.5 rounded-lg text-sm ${isMyComment
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                            }`}
                        >
                          <p className="whitespace-pre-wrap">{comment.Comment}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={commentEndRef} />
            </div>

            {/* 댓글 작성 폼 */}
            <form onSubmit={handleAddComment} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  전송
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 수평 리사이저 (왼쪽/오른쪽 사이) */}
        <div
          className="w-2 cursor-col-resize flex items-center justify-center group"
          onMouseDown={handleHorizontalMouseDown}
        >
          <div className="h-12 w-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-primary-400 transition-colors"></div>
        </div>

        {/* 오른쪽: AI 챗봇 */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              AI 학습 도우미
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              이 문제에 대해 궁금한 점을 물어보세요
            </p>
          </div>

          {/* 채팅 메시지 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatSessionLoading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                <p className="text-sm">로딩 중...</p>
              </div>
            ) : chatMessages.length === 0 && !streamingMessage ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                <p className="text-sm mb-2">AI에게 질문해보세요</p>
                <div className="space-y-1 text-xs">
                  <p>"이 문제 왜 틀렸어?"</p>
                  <p>"정답이 왜 A야?"</p>
                  <p>"관련 개념 설명해줘"</p>
                </div>
              </div>
            ) : (
              <>
                {chatMessages.map((msg) => (
                  <div
                    key={msg.AI_chatID}
                    className={`flex ${msg.sender === 'User' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-2.5 rounded-lg ${msg.sender === 'User'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
                {/* 스트리밍 중인 메시지 */}
                {streamingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                      <p className="whitespace-pre-wrap text-sm">{streamingMessage}</p>
                    </div>
                  </div>
                )}
                {/* 로딩 중 표시 */}
                {chatLoading && !streamingMessage && (
                  <div className="flex justify-start">
                    <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 채팅 입력 폼 */}
          <form onSubmit={handleSendChatMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="질문을 입력하세요..."
                disabled={chatLoading || !chatSessionId}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-gray-100 dark:disabled:bg-gray-600"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim() || !chatSessionId}
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {chatLoading ? '...' : '전송'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 문제 토론하기 핸들러 (재풀이 후 상세 화면으로 이동)
  const handleGoToDiscussion = () => {
    loadChatSession(selectedQuestion.QuestionID);
    setChatMessages([]);
    setStreamingMessage('');
    setView('detail');
  };

  // === 재풀이 모드 화면 ===
  if (view === 'retry') {
    const isCorrect = showResult && selectedAnswer === selectedQuestion?.correctAnswer;
    const isWrong = showResult && selectedAnswer !== selectedQuestion?.correctAnswer;

    return (
      <div className="h-[calc(100vh-12rem)]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
          {/* 헤더 */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  문제 다시 풀기
                </h2>
              </div>
            </div>
          </div>

          {/* 문제 내용 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-gray-900 dark:text-white text-lg font-medium">
              {selectedQuestion?.question}
            </p>

            {/* 보기 */}
            <div className="space-y-2">
              {['A', 'B', 'C', 'D'].map((option) => {
                const optionText = selectedQuestion?.[`option${option}`];
                if (!optionText) return null;

                const isSelected = selectedAnswer === option;
                const isCorrectAnswer = selectedQuestion?.correctAnswer === option;

                let bgClass = 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700';
                let textClass = '';

                if (showResult) {
                  if (isCorrectAnswer) {
                    bgClass = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                    textClass = 'text-green-600 dark:text-green-400';
                  } else if (isSelected && !isCorrectAnswer) {
                    bgClass = 'border-red-500 bg-red-50 dark:bg-red-900/20';
                    textClass = 'text-red-600 dark:text-red-400';
                  }
                } else if (isSelected) {
                  bgClass = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
                }

                return (
                  <div
                    key={option}
                    onClick={() => handleAnswerSelect(option)}
                    className={`p-4 rounded-lg border-2 ${bgClass} ${!showResult ? 'cursor-pointer hover:border-primary-400' : 'cursor-default'
                      } transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="font-semibold text-gray-900 dark:text-white mr-2">
                          {option}.
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {optionText}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && !showResult && (
                          <span className="text-primary-600 dark:text-primary-400 font-semibold">
                            선택됨
                          </span>
                        )}
                        {showResult && isCorrectAnswer && (
                          <span className={`font-semibold ${textClass}`}>
                            정답
                          </span>
                        )}
                        {showResult && isSelected && !isCorrectAnswer && (
                          <span className={`font-semibold ${textClass}`}>
                            오답
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 결과 및 해설 */}
            {showResult && (
              <div className="space-y-4 mt-6">
                {/* 결과 표시 */}
                <div className={`p-4 rounded-lg border-l-4 ${isCorrect
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  }`}>
                  <p className={`font-semibold text-lg ${isCorrect
                    ? 'text-green-900 dark:text-green-300'
                    : 'text-red-900 dark:text-red-300'
                    }`}>
                    {isCorrect ? '정답입니다!' : '오답입니다.'}
                  </p>
                  {isWrong && (
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      정답은 <strong>{selectedQuestion?.correctAnswer}</strong>번입니다.
                    </p>
                  )}
                </div>

                {/* 해설 */}
                {selectedQuestion?.explanation && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                    <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      해설
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 버튼 영역 */}
          <div className="p-5 border-t border-gray-200 dark:border-gray-700">
            {!showResult ? (
              <button
                onClick={handleSubmitAnswer}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
              >
                답안 제출
              </button>
            ) : (
              <button
                onClick={handleGoToDiscussion}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                문제 토론하기
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
