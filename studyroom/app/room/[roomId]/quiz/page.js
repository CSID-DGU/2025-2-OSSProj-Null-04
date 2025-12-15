'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;
  const queryClient = useQueryClient();
  const [deletingQuizId, setDeletingQuizId] = useState(null);
  const [downloadingQuizId, setDownloadingQuizId] = useState(null);

  // 사용자 권한 조회
  const { data: userRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ['userRole', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/me`);
      if (!res.ok) throw new Error('권한 조회 실패');
      return res.json();
    },
    enabled: !!roomId,
  });

  const isGuest = userRole?.role === 'guest';
  const isButtonDisabled = isLoadingRole || isGuest;

  // 퀴즈 목록 조회 (useQuery)
  const { data: quizzes = [], isLoading: loading, error } = useQuery({
    queryKey: ['quizzes', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/quiz/${roomId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 목록을 불러오는데 실패했습니다');
      }

      return data.quizzes;
    },
    enabled: !!roomId,
    staleTime: 2 * 60 * 1000, // 2분
  });

  const handleCreateQuiz = () => {
    router.push(`/room/${roomId}/quiz/create`);
  };

  const handleTakeQuiz = (quizId) => {
    router.push(`/room/${roomId}/quiz/${quizId}/take`);
  };

  // 퀴즈 삭제 mutation
  const deleteQuizMutation = useMutation({
    mutationFn: async (quizId) => {
      const res = await fetch(`/api/quiz/${roomId}/${quizId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 삭제에 실패했습니다');
      }

      return data;
    },
    onMutate: (quizId) => {
      setDeletingQuizId(quizId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes', roomId]);
    },
    onError: (err) => {
      alert(err.message || '퀴즈 삭제에 실패했습니다');
    },
    onSettled: () => {
      setDeletingQuizId(null);
    }
  });

  const handleDeleteQuiz = (quizId) => {
    if (!confirm('이 퀴즈를 삭제하시겠습니까?\n삭제된 퀴즈는 복구할 수 없습니다.')) return;
    deleteQuizMutation.mutate(quizId);
  };

  const handleDownloadQuiz = async (quiz) => {
    setDownloadingQuizId(quiz.QuizID);
    try {
      // 퀴즈 문제 조회
      const res = await fetch(`/api/quiz/${roomId}/${quiz.QuizID}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 정보를 불러올 수 없습니다');
      }

      // 정답지 포함 여부 확인
      const includeAnswers = confirm('정답 및 해설을 포함하시겠습니까?');

      // 동적 import로 DOCX 생성
      const { generateQuizDocument } = await import('@/lib/docx/quizDocument');
      await generateQuizDocument(quiz, data.questions, includeAnswers);
    } catch (err) {
      alert(`다운로드 실패: ${err.message}`);
    } finally {
      setDownloadingQuizId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 & 퀴즈 생성 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            퀴즈
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            퀴즈를 생성하고 풀어보세요
          </p>
        </div>
        <button
          onClick={handleCreateQuiz}
          disabled={isButtonDisabled}
          className={`bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isButtonDisabled ? 'cursor-not-allowed' : ''
          }`}
        >
          + 퀴즈 생성
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-5">
          {error.message}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">퀴즈 목록을 불러오는 중...</p>
          </div>
        </div>
      ) : quizzes.length === 0 ? (
        /* 퀴즈 없음 */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">
              아직 생성된 퀴즈가 없습니다
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              첫 번째 퀴즈를 생성해보세요!
            </p>
          </div>
        </div>
      ) : (
        /* 퀴즈 리스트 */
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.QuizID}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors p-5 flex justify-between items-center"
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {quiz.QuizTitle}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  문제 수: {quiz.questionCount}개
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* 다운로드 - 보조 액션 (아이콘) */}
                <button
                  onClick={() => handleDownloadQuiz(quiz)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-60"
                  disabled={downloadingQuizId === quiz.QuizID}
                  title="문제지 다운로드"
                  aria-label="문제지 다운로드"
                >
                  {downloadingQuizId === quiz.QuizID ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                </button>

                {/* 삭제 - 위험 액션 (아이콘) */}
                <button
                  onClick={() => handleDeleteQuiz(quiz.QuizID)}
                  className={`p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-60 ${
                    isButtonDisabled ? 'cursor-not-allowed' : ''
                  }`}
                  disabled={isButtonDisabled || (deleteQuizMutation.isPending && deletingQuizId === quiz.QuizID)}
                  title="퀴즈 삭제"
                  aria-label="퀴즈 삭제"
                >
                  {deleteQuizMutation.isPending && deletingQuizId === quiz.QuizID ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>

                {/* 퀴즈 풀기 - 메인 액션 (부각, 오른쪽) */}
                <button
                  onClick={() => handleTakeQuiz(quiz.QuizID)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow disabled:opacity-60 flex items-center gap-2 ml-4"
                  disabled={deleteQuizMutation.isPending && deletingQuizId === quiz.QuizID}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  퀴즈 풀기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
