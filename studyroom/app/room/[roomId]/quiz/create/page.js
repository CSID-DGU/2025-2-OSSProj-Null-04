'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CreateQuizPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId;

  // 기본 설정
  const [quizTitle, setQuizTitle] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [creationMode, setCreationMode] = useState(null); // 'auto' or 'manual'

  // 파일 목록
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);

  // 문제 목록 (수동 추가 + AI 생성)
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    explanation: ''
  });

  // 로딩 상태
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 진행바 상태
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  useEffect(() => {
    fetchFiles();
  }, [roomId]);

  const fetchFiles = async () => {
    try {
      setFilesLoading(true);
      const res = await fetch(`/api/file/${roomId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '파일 목록을 불러오는데 실패했습니다');
      }

      setFiles(data.files);
    } catch (err) {
      setError(err.message);
    } finally {
      setFilesLoading(false);
    }
  };

  const handleFileToggle = (fileId) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleAutoGenerate = async () => {
    if (!quizTitle.trim()) {
      alert('퀴즈 제목을 입력해주세요');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setProgress(0);
      setProgressMessage('파일 분석 중...');

      // 진행바 시뮬레이션 시작
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 20) {
            setProgressMessage('파일 분석 중...');
            return prev + 4; // 0-20%: 5초
          } else if (prev < 80) {
            setProgressMessage('문제 생성 중...');
            return prev + 6; // 20-80%: 10초
          } else if (prev < 90) {
            setProgressMessage('거의 완료...');
            return prev + 2; // 80-90%: 5초
          }
          return prev;
        });
      }, 1000);

      // AI 퀴즈 생성
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFiles.length > 0 ? selectedFiles : null,
          questionCount: questionCount - questions.length, // 남은 문제 수
          difficulty,
          quizTitle
        })
      });

      const data = await res.json();

      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || 'AI 퀴즈 생성에 실패했습니다');
      }

      // 100% 표시
      setProgress(100);
      setProgressMessage('생성 완료!');

      // 기존 수동 문제 + AI 생성 문제 합치기
      const allQuestions = [...questions, ...data.questions];

      // 퀴즈 저장
      await saveQuiz(allQuestions, progressInterval);

    } catch (err) {
      setError(err.message);
      setProgress(0);
      setProgressMessage('');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddManualQuestion = () => {
    // 현재 문제 검증
    if (!currentQuestion.question.trim()) {
      alert('문제를 입력해주세요');
      return;
    }
    if (!currentQuestion.optionA.trim() || !currentQuestion.optionB.trim() ||
        !currentQuestion.optionC.trim() || !currentQuestion.optionD.trim()) {
      alert('모든 선택지를 입력해주세요');
      return;
    }
    if (!currentQuestion.correctAnswer) {
      alert('정답을 선택해주세요');
      return;
    }

    // 문제 추가
    setQuestions([...questions, currentQuestion]);

    // 현재 문제 초기화
    setCurrentQuestion({
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: '',
      explanation: ''
    });
  };

  const handleGenerateRemaining = async () => {
    const remaining = questionCount - questions.length;

    if (remaining <= 0) {
      alert('이미 설정한 문제 수를 채웠습니다');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      setProgress(0);
      setProgressMessage('파일 분석 중...');

      // 진행바 시뮬레이션 시작
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 20) {
            setProgressMessage('파일 분석 중...');
            return prev + 4;
          } else if (prev < 80) {
            setProgressMessage('문제 생성 중...');
            return prev + 6;
          } else if (prev < 90) {
            setProgressMessage('거의 완료...');
            return prev + 2;
          }
          return prev;
        });
      }, 1000);

      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFiles.length > 0 ? selectedFiles : null,
          questionCount: remaining,
          difficulty,
          quizTitle
        })
      });

      const data = await res.json();

      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || 'AI 퀴즈 생성에 실패했습니다');
      }

      // 100% 표시
      setProgress(100);
      setProgressMessage('생성 완료!');

      setQuestions([...questions, ...data.questions]);

      // 0.3초 후 진행바 숨기기
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 300);

    } catch (err) {
      setError(err.message);
      setProgress(0);
      setProgressMessage('');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveManualQuiz = async () => {
    if (!quizTitle.trim()) {
      alert('퀴즈 제목을 입력해주세요');
      return;
    }

    if (questions.length === 0) {
      alert('최소 1개의 문제를 추가해주세요');
      return;
    }

    await saveQuiz(questions);
  };

  const saveQuiz = async (questionsToSave) => {
    try {
      setSaving(true);

      const res = await fetch('/api/quiz/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          quizTitle,
          questions: questionsToSave,
          fileIds: selectedFiles
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '퀴즈 저장에 실패했습니다');
      }

      // 0.3초 후 퀴즈 목록으로 이동
      setTimeout(() => {
        router.push(`/room/${roomId}/quiz`);
      }, 300);

    } catch (err) {
      setError(err.message);
      setProgress(0);
      setProgressMessage('');
    } finally {
      setSaving(false);
    }
  };

  // 초기 설정 화면
  if (creationMode === null) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          퀴즈 생성
        </h1>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 진행바 */}
        {generating && progress > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              AI 퀴즈 생성 중...
            </h2>
            <div className="space-y-3">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-primary-600 h-4 rounded-full transition-all duration-200 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${progress}%` }}
                >
                  <span className="text-xs font-semibold text-white">{progress}%</span>
                </div>
              </div>
              <p className="text-center text-gray-700 dark:text-gray-300 font-medium">
                {progressMessage}
              </p>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                생성 중에는 페이지를 닫지 마세요
              </p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
          {/* 퀴즈 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              퀴즈 제목 (주제)
            </label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="예: 1학기 중간고사 대비"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* 파일 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              퀴즈 생성 자료 선택 <span className="text-gray-500 text-sm">(선택사항)</span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              파일을 선택하면 해당 자료를 기반으로 퀴즈를 생성하고, 선택하지 않으면 주제를 기반으로 생성합니다.
            </p>
            {filesLoading ? (
              <p className="text-gray-500 dark:text-gray-400">파일 목록 불러오는 중...</p>
            ) : files.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">업로드된 파일이 없습니다. (주제 기반으로 퀴즈가 생성됩니다)</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                {files.map(file => (
                  <label key={file.FileID} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.FileID)}
                      onChange={() => handleFileToggle(file.FileID)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">{file.FileName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 문제 수 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              문제 수
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* 난이도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              퀴즈 난이도
            </label>
            <div className="flex space-x-4">
              {[
                { value: 'easy', label: '쉬움' },
                { value: 'medium', label: '보통' },
                { value: 'hard', label: '어려움' }
              ].map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="difficulty"
                    value={option.value}
                    checked={difficulty === option.value}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 생성 방식 선택 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              문제 생성 방식을 선택하세요
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleAutoGenerate}
                disabled={generating || !quizTitle.trim()}
                className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {generating ? 'AI 생성 중...' : '자동 생성 (AI)'}
              </button>
              <button
                onClick={() => setCreationMode('manual')}
                disabled={!quizTitle.trim()}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                문제 직접 추가
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/room/${roomId}/quiz`)}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          ← 퀴즈 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // 수동 문제 추가 화면
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        퀴즈 생성: {quizTitle}
      </h1>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 진행바 */}
      {generating && progress > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
            AI 퀴즈 생성 중...
          </h2>
          <div className="space-y-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-primary-600 h-4 rounded-full transition-all duration-200 ease-out flex items-center justify-end pr-2"
                style={{ width: `${progress}%` }}
              >
                <span className="text-xs font-semibold text-white">{progress}%</span>
              </div>
            </div>
            <p className="text-center text-gray-700 dark:text-gray-300 font-medium">
              {progressMessage}
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              생성 중에는 페이지를 닫지 마세요
            </p>
          </div>
        </div>
      )}

      {/* 진행 상황 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg mb-6">
        현재 {questions.length}개 문제 추가됨 (목표: {questionCount}개)
      </div>

      {/* 문제 입력 폼 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          문제 {questions.length + 1} 입력
        </h2>

        {/* 문제 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            문제
          </label>
          <textarea
            value={currentQuestion.question}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
            rows="3"
            placeholder="문제를 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* 선택지 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['A', 'B', 'C', 'D'].map(option => (
            <div key={option}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                선택지 {option}
              </label>
              <input
                type="text"
                value={currentQuestion[`option${option}`]}
                onChange={(e) => setCurrentQuestion({ ...currentQuestion, [`option${option}`]: e.target.value })}
                placeholder={`선택지 ${option} 입력`}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          ))}
        </div>

        {/* 정답 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            정답
          </label>
          <div className="flex space-x-4">
            {['A', 'B', 'C', 'D'].map(option => (
              <label key={option} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="correctAnswer"
                  value={option}
                  checked={currentQuestion.correctAnswer === option}
                  onChange={(e) => setCurrentQuestion({ ...currentQuestion, correctAnswer: e.target.value })}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 해설 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            해설 (선택사항)
          </label>
          <textarea
            value={currentQuestion.explanation}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
            rows="2"
            placeholder="해설을 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* 문제 추가 버튼 */}
        <button
          onClick={handleAddManualQuestion}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          다음 문제 추가
        </button>
      </div>

      {/* 하단 버튼 */}
      <div className="flex space-x-4">
        <button
          onClick={handleGenerateRemaining}
          disabled={generating || questions.length >= questionCount}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {generating ? 'AI 생성 중...' : `나머지 ${questionCount - questions.length}개 문제 자동 생성`}
        </button>
        <button
          onClick={handleSaveManualQuiz}
          disabled={saving || questions.length === 0}
          className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {saving ? '저장 중...' : '퀴즈 저장'}
        </button>
      </div>

      <button
        onClick={() => router.push(`/room/${roomId}/quiz`)}
        className="mt-4 text-primary-600 hover:text-primary-700"
      >
        ← 퀴즈 목록으로 돌아가기
      </button>
    </div>
  );
}
