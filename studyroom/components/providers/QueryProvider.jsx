'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5분간 fresh (재요청 안 함)
        cacheTime: 10 * 60 * 1000, // 10분간 캐시 유지
        refetchOnWindowFocus: false, // 윈도우 포커스 시 재요청 안 함
        refetchOnReconnect: false, // 재연결 시 재요청 안 함
        retry: 1, // 실패 시 1회만 재시도
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
