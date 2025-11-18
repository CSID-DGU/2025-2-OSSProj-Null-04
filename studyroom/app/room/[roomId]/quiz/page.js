'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 퀴즈 목록 가져오기
  useEffect(() => {
    fetchQuizzes();
  }, [roomId]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quiz/${roomId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 목록을 불러오는데 실패했습니다');
      }

      setQuizzes(data.quizzes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = () => {
    router.push(`/room/${roomId}/quiz/create`);
  };

  const handleTakeQuiz = (quizId) => {
    router.push(`/room/${roomId}/quiz/${quizId}/take`);
  };

  return (
    <div className="p-6">
      {/* 헤더 & 퀴즈 생성 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          퀴즈
        </h1>
        <button
          onClick={handleCreateQuiz}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + 퀴즈 생성
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">퀴즈 목록을 불러오는 중...</p>
        </div>
      ) : quizzes.length === 0 ? (
        /* 퀴즈 없음 */
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
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
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            아직 생성된 퀴즈가 없습니다
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            첫 번째 퀴즈를 생성해보세요!
          </p>
        </div>
      ) : (
        /* 퀴즈 리스트 */
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.QuizID}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 flex justify-between items-center"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {quiz.QuizTitle}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  문제 수: {quiz.questionCount}개
                </p>
              </div>
              <button
                onClick={() => handleTakeQuiz(quiz.QuizID)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
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
