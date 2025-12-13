'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import QuestionText from '@/components/QuestionText';

export default function TakeQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { roomId, quizId } = params;

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [gradingResults, setGradingResults] = useState(null); // 채점 결과

  useEffect(() => {
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, quizId]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quiz/${roomId}/${quizId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈를 불러오는데 실패했습니다');
      }

      setQuiz(data.quiz);
      setQuestions(data.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerChange = (answer) => {
    setSelectedAnswer(answer);
    setUserAnswers({
      ...userAnswers,
      [currentQuestion.QuestionID]: answer
    });
  };

  const handleNext = () => {
    if (!selectedAnswer && !userAnswers[currentQuestion.QuestionID]) {
      alert('답을 선택하거나 입력해주세요');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      // 다음 문제로
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // 다음 문제에 이미 답변이 있으면 불러오기
      setSelectedAnswer(userAnswers[questions[currentQuestionIndex + 1].QuestionID] || '');
    } else {
      // 마지막 문제
      // 아직 아무것도 하지 않음 (채점하기 버튼으로 제출)
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(userAnswers[questions[currentQuestionIndex - 1].QuestionID] || '');
    }
  };

  const submitQuiz = async () => {
    try {
      setSubmitting(true);

      const res = await fetch(`/api/quiz/${roomId}/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswers })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '제출에 실패했습니다');
      }

      setGradingResults(data);
      setQuizCompleted(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToQuizList = () => {
    router.push(`/room/${roomId}/quiz`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">퀴즈를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={handleBackToQuizList}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          ← 퀴즈 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // 퀴즈 완료 화면
  if (quizCompleted && gradingResults) {
    return (
      <div className="p-5 max-w-5xl mx-auto">
        {/* 점수 요약 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              퀴즈 완료!
            </h2>
            <div className="text-5xl font-bold text-primary-600 mb-4">
              {gradingResults.score}점
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {gradingResults.correctCount}/{gradingResults.totalCount} 문제 정답
            </p>
          </div>
        </div>

        {/* 문제별 결과 */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            문제별 결과
          </h3>
          {questions.map((question, index) => {
            const result = gradingResults.results.find(r => r.questionId === question.QuestionID);
            const userAnswer = userAnswers[question.QuestionID] || '(미작성)';
            const isCorrect = result?.isCorrect;

            return (
              <div
                key={question.QuestionID}
                className={`bg-white dark:bg-gray-800 rounded-lg border-2 p-5 ${isCorrect
                  ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10'
                  : 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                  }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <QuestionText
                      text={question.question}
                      className="font-medium text-gray-900 dark:text-white mb-2"
                    />
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">내 답변: </span>
                        <span className="text-gray-600 dark:text-gray-400">{userAnswer}</span>
                      </div>
                      {!isCorrect && (
                        <div>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">정답: </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {question.questionType === 'MCQ'
                              ? `${question.correctAnswer}) ${question[`option${question.correctAnswer}`]}`
                              : question.correctAnswer}
                          </span>
                        </div>
                      )}
                      {result?.feedback && (
                        <div className={`p-3 rounded-lg mt-2 ${isCorrect
                          ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                          }`}>
                          <p className={`text-sm ${isCorrect ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                            }`}>
                            {result.feedback}
                          </p>
                        </div>
                      )}
                      {question.explanation && (
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">해설:</p>
                          <p className="text-gray-600 dark:text-gray-400">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleBackToQuizList}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          퀴즈 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">문제가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5">
        <button
          onClick={handleBackToQuizList}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← 퀴즈 목록으로
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {quiz?.QuizTitle}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          문제 {currentQuestionIndex + 1} / {questions.length}
        </p>
      </div>

      {/* 문제 카드 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${currentQuestion.questionType === 'short'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : currentQuestion.questionType === 'essay'
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
            {currentQuestion.questionType === 'short' ? '단답형'
              : currentQuestion.questionType === 'essay' ? '서술형'
                : '객관식'}
          </span>
        </div>

        <QuestionText
          text={currentQuestion.question}
          className="text-lg font-semibold text-gray-900 dark:text-white mb-6"
        />

        {/* 객관식(MCQ): 선택지 */}
        {(!currentQuestion.questionType || currentQuestion.questionType === 'MCQ') && (
          <div className="space-y-3">
            {['A', 'B', 'C', 'D'].map((option) => {
              const optionText = currentQuestion[`option${option}`];
              if (!optionText) return null;

              const isSelected = selectedAnswer === option;

              return (
                <button
                  key={option}
                  onClick={() => handleAnswerChange(option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isSelected
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <div className="flex items-center">
                    <span className="font-semibold mr-3">{option}.</span>
                    <span>{optionText}</span>
                    {isSelected && <span className="ml-auto text-xl">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 단답형(short): 텍스트 입력 */}
        {currentQuestion.questionType === 'short' && (
          <div className="space-y-3">
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="정답을 입력하세요"
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            />
          </div>
        )}

        {/* 서술형(essay): textarea 입력 */}
        {currentQuestion.questionType === 'essay' && (
          <div className="space-y-3">
            <textarea
              value={selectedAnswer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="답안을 작성하세요"
              rows={6}
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>
        )}


      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="px-6 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← 이전
        </button>
        <div className="flex gap-2">
          {currentQuestionIndex < questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              다음 →
            </button>
          ) : (
            <button
              onClick={submitQuiz}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {submitting ? '채점 중...' : '채점하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
