'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function TakeQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { roomId, quizId } = params;

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);

  useEffect(() => {
    fetchQuiz();
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

  const handleAnswerSelect = (answer) => {
    if (showResult) return; // 이미 확인한 문제는 선택 불가
    setSelectedAnswer(answer);
  };

  const handleConfirm = () => {
    if (!selectedAnswer) {
      alert('답을 선택해주세요');
      return;
    }

    // 정답 확인
    const correct = selectedAnswer === currentQuestion.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    // 답안 저장
    setUserAnswers({
      ...userAnswers,
      [currentQuestion.QuestionID]: selectedAnswer
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // 다음 문제로
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer('');
      setShowResult(false);
      setIsCorrect(false);
    } else {
      // 마지막 문제 - 제출
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    try {
      setSubmitting(true);

      // 모든 답안 배열로 변환
      const answers = questions.map(q => ({
        questionId: q.QuestionID,
        userAnswer: userAnswers[q.QuestionID] || ''
      }));

      const res = await fetch(`/api/quiz/${roomId}/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '제출에 실패했습니다');
      }

      setFinalScore(data);
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
  if (quizCompleted && finalScore) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            퀴즈 완료!
          </h2>
          <div className="text-5xl font-bold text-primary-600 mb-4">
            {finalScore.score}점
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {finalScore.correctCount}/{finalScore.totalCount} 문제 정답
          </p>
          <button
            onClick={handleBackToQuizList}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            퀴즈 목록으로 돌아가기
          </button>
        </div>
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          {currentQuestion.question}
        </h2>

        {/* 선택지 */}
        <div className="space-y-3">
          {['A', 'B', 'C', 'D'].map((option) => {
            const optionText = currentQuestion[`option${option}`];
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = showResult && currentQuestion.correctAnswer === option;
            const isWrongAnswer = showResult && isSelected && !isCorrect;

            let buttonClass = 'w-full text-left p-4 rounded-lg border-2 transition-all ';

            if (showResult) {
              if (isCorrectAnswer) {
                buttonClass += 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
              } else if (isWrongAnswer) {
                buttonClass += 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400';
              } else {
                buttonClass += 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500';
              }
            } else {
              if (isSelected) {
                buttonClass += 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400';
              } else {
                buttonClass += 'border-gray-200 dark:border-gray-700 hover:border-primary-400 text-gray-700 dark:text-gray-300';
              }
            }

            return (
              <button
                key={option}
                onClick={() => handleAnswerSelect(option)}
                disabled={showResult}
                className={buttonClass}
              >
                <div className="flex items-center">
                  <span className="font-semibold mr-3">{option}.</span>
                  <span>{optionText}</span>
                  {showResult && isCorrectAnswer && <span className="ml-auto text-xl">✓</span>}
                  {showResult && isWrongAnswer && <span className="ml-auto text-xl">✗</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* 정답/오답 메시지 */}
        {showResult && (
          <div className={`mt-6 p-4 rounded-lg ${
            isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <p className={`font-semibold mb-2 ${
              isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}>
              {isCorrect ? '✓ 정답입니다!' : '✗ 오답입니다.'}
            </p>
            {currentQuestion.explanation && (
              <div className="text-gray-700 dark:text-gray-300">
                <p className="font-medium mb-1">해설:</p>
                <p>{currentQuestion.explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 버튼 영역 */}
      <div className="flex justify-end">
        {!showResult ? (
          <button
            onClick={handleConfirm}
            disabled={!selectedAnswer}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            확인
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={submitting}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {submitting ? '제출 중...' : currentQuestionIndex < questions.length - 1 ? '다음 문제' : '제출하기'}
          </button>
        )}
      </div>
    </div>
  );
}
