'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;

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
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
              <button
                onClick={() => handleTakeQuiz(quiz.QuizID)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                퀴즈 풀기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
