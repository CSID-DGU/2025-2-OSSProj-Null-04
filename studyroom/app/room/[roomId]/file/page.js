'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function FilePage() {
  const params = useParams();
  const roomId = params?.roomId;
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]); // 업로드 중인 파일들 { id, name, progress }
  const [dragCounter, setDragCounter] = useState(0); // 드래그 카운터

  // localStorage 키
  const STORAGE_KEY = `uploading_files_${roomId}`;

  // 컴포넌트 마운트 시 localStorage에서 업로드 중인 파일 복원
  useEffect(() => {
    if (!roomId) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedFiles = JSON.parse(stored);
        setUploadingFiles(parsedFiles);

        // 복원된 파일들의 업로드를 재개
        parsedFiles.forEach(file => {
          resumeUploadInternal(file);
        });
      }
    } catch (error) {
      console.error('Failed to restore uploading files:', error);
    }

    // resumeUpload는 한 번만 호출되므로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // uploadingFiles 변경 시 localStorage에 저장
  useEffect(() => {
    if (!roomId) return;

    if (uploadingFiles.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uploadingFiles));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [uploadingFiles, roomId]);

  // 파일 목록 조회 (useQuery)
  const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['files', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/file`, {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '파일 목록을 불러오지 못했습니다.');
      }

      return Array.isArray(data.files) ? data.files : [];
    },
    enabled: !!roomId,
    staleTime: 60 * 1000, // 1분
  });

  // 파일 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId) => {
      const res = await fetch(`/api/room/${roomId}/file/${fileId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['files', roomId]);
    },
  });

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFile || !roomId) {
      setUploadError('업로드할 파일을 선택해주세요.');
      return;
    }

    // 임시 ID 생성
    const tempId = `temp-${Date.now()}`;
    const fileName = selectedFile.name;

    // 즉시 업로드 중 목록에 추가
    setUploadingFiles(prev => [...prev, {
      id: tempId,
      name: fileName,
      progress: 0
    }]);

    // 선택된 파일 초기화
    const fileToUpload = selectedFile;
    setSelectedFile(null);
    setUploadError('');

    // 진행률 시뮬레이션 시작
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 90) currentProgress = 90;

      setUploadingFiles(prev =>
        prev.map(f => f.id === tempId ? { ...f, progress: Math.floor(currentProgress) } : f)
      );
    }, 500);

    try {
      // 백그라운드에서 실제 업로드 수행
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetch(`/api/room/${roomId}/file`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || '업로드에 실패했습니다.');
      }

      // 100% 완료 표시
      setUploadingFiles(prev =>
        prev.map(f => f.id === tempId ? { ...f, progress: 100 } : f)
      );

      // 0.5초 후 목록에서 제거하고 파일 목록 새로고침
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== tempId));
        queryClient.invalidateQueries(['files', roomId]);
      }, 500);

    } catch (error) {
      clearInterval(progressInterval);

      // 업로드 실패 시 목록에서 제거
      setUploadingFiles(prev => prev.filter(f => f.id !== tempId));
      setUploadError(error.message || '파일 업로드 중 오류가 발생했습니다.');
    }
  };

  // 페이지 복원 시 업로드 재개 (진행률만 시뮬레이션)
  const resumeUploadInternal = (file) => {
    let currentProgress = file.progress || 0;

    // 이미 완료된 파일은 제거
    if (currentProgress >= 100) {
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.id !== file.id));
        queryClient.invalidateQueries(['files', roomId]);
      }, 500);
      return;
    }

    // 진행률 시뮬레이션 재개
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 95) currentProgress = 95;

      setUploadingFiles(prev => {
        const exists = prev.find(f => f.id === file.id);
        if (!exists) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev.map(f => f.id === file.id ? { ...f, progress: Math.floor(currentProgress) } : f);
      });

      // 95%에 도달하면 완료 처리
      if (currentProgress >= 95) {
        clearInterval(progressInterval);

        setUploadingFiles(prev =>
          prev.map(f => f.id === file.id ? { ...f, progress: 100 } : f)
        );

        // 1초 후 목록에서 제거하고 파일 목록 새로고침
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.id !== file.id));
          queryClient.invalidateQueries(['files', roomId]);
        }, 1000);
      }
    }, 500);
  };

  // 드래그 이벤트 핸들러
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setUploadError('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          파일 관리
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          강의실 자료를 업로드하고 관리할 수 있어요.
        </p>
      </div>

      {/* 파일 업로드 섹션 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          파일 업로드
        </h3>

        {/* 드래그앤드롭 영역 */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${isDragging
            ? 'border-primary-600 bg-primary-100 dark:bg-primary-900/30 scale-[1.02] shadow-lg'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-primary-500/10 rounded-lg animate-pulse pointer-events-none"></div>
          )}
          <div className="space-y-3 relative">
            {/* 아이콘 */}
            <div className="flex justify-center">
              <svg
                className={`w-12 h-12 transition-all duration-200 ${isDragging
                  ? 'text-primary-600 scale-110'
                  : 'text-gray-400 dark:text-gray-500'
                  }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            {/* 텍스트 */}
            <div>
              <p className={`text-base font-medium transition-colors ${isDragging
                ? 'text-primary-700 dark:text-primary-400'
                : 'text-gray-900 dark:text-white'
                }`}>
                {isDragging ? '📁 파일을 여기에 놓으세요!' : '파일을 드래그하여 업로드'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                또는 아래 버튼을 클릭하세요
              </p>
            </div>

            {/* 선택된 파일 표시 */}
            {selectedFile && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 파일 선택 버튼 및 업로드 */}
        <form onSubmit={handleUpload} className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex-1">
              <input
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="hidden"
                id="file-input"
              />
              <div className="cursor-pointer px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium text-center transition-colors">
                파일 선택
              </div>
            </label>
            <button
              type="submit"
              disabled={!selectedFile}
              className="flex-1 px-6 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
            >
              업로드
            </button>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {uploadError}
            </div>
          )}
        </form>
      </div>

      {/* 업로드된 파일 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          업로드된 파일
        </h3>

        {filesLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">파일 목록을 불러오는 중...</p>
          </div>
        )}

        {filesError && (
          <p className="text-sm text-red-600 dark:text-red-400 py-4">{filesError.message}</p>
        )}

        {!filesLoading && !filesError && files.length === 0 && uploadingFiles.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-4">
            아직 업로드된 파일이 없습니다.
          </p>
        )}

        {deleteMutation.isError && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {deleteMutation.error.message || '파일 삭제 중 오류가 발생했습니다.'}
          </p>
        )}

        {(!filesLoading && (files.length > 0 || uploadingFiles.length > 0)) && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {/* 업로드 중인 파일들 */}
            {uploadingFiles.map((uploadingFile) => (
              <li key={uploadingFile.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 bg-blue-50 dark:bg-blue-900/10 -mx-5 px-5">
                <div className="flex flex-col flex-1 pr-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {uploadingFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    업로드 중...
                  </p>
                </div>
                <div className="w-48">
                  {/* 진행바 */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadingFile.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                      {uploadingFile.progress}%
                    </span>
                  </div>
                </div>
              </li>
            ))}

            {/* 업로드된 파일들 */}
            {files.map((file) => (
              <li key={file.FileID} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col flex-1 pr-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.FileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {file.UploadedAt
                      ? new Date(file.UploadedAt).toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      })
                      : '업로드 시각 미상'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/room/${roomId}/file/${file.FileID}/download`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    다운로드
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(file.FileID)}
                    disabled={deleteMutation.isPending}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
