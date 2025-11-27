'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function FilePage() {
  const params = useParams();
  const roomId = params?.roomId;
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');

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

  // 파일 업로드 mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await fetch(`/api/room/${roomId}/file`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '업로드에 실패했습니다.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['files', roomId]);
      setSelectedFile(null);
      setUploadError('');
    },
    onError: (error) => {
      setUploadError(error.message || '파일 업로드 중 오류가 발생했습니다.');
    },
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

    const formData = new FormData();
    formData.append('file', selectedFile);
    uploadMutation.mutate(formData);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-all duration-300">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        파일 관리 페이지
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        강의실 자료를 업로드하고 관리할 수 있어요.
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            파일 선택
          </label>
          <input
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-gray-700 dark:file:text-gray-100"
          />
        </div>

        {uploadMutation.isSuccess && (
          <div className="text-sm text-green-600 dark:text-green-400">
            파일 업로드가 완료되었습니다.
          </div>
        )}

        {uploadError && (
          <div className="text-sm text-red-600 dark:text-red-400">
            {uploadError}
          </div>
        )}

        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 disabled:bg-gray-400 disabled:text-gray-200"
        >
          {uploadMutation.isPending ? '업로드 중...' : '업로드'}
        </button>
      </form>

      <div className="mt-10">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          업로드된 파일
        </h3>

        {filesLoading && (
          <div className="text-center py-8 animate-pulse">
            <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">파일 목록을 불러오는 중...</p>
          </div>
        )}

        {filesError && (
          <p className="text-sm text-red-600 dark:text-red-400">{filesError.message}</p>
        )}

        {!filesLoading && !filesError && files.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            아직 업로드된 파일이 없습니다.
          </p>
        )}

        {deleteMutation.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {deleteMutation.error.message || '파일 삭제 중 오류가 발생했습니다.'}
          </p>
        )}

        {!filesLoading && files.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
            {files.map((file) => (
              <li key={file.FileID} className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-col flex-1 pr-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {file.FileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {file.UploadedAt
                      ? new Date(file.UploadedAt).toLocaleString()
                      : '업로드 시각 미상'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/room/${roomId}/file/${file.FileID}/download`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    다운로드
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(file.FileID)}
                    disabled={deleteMutation.isPending}
                    className="text-sm text-red-600 hover:underline cursor-pointer bg-transparent p-0 disabled:opacity-50"
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
