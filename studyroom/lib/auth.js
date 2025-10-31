import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * 현재 로그인한 사용자 정보를 가져옵니다
 * @returns {Promise<Object|null>} 사용자 정보 또는 null
 */
export async function getCurrentUser() {
  const supabase = createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // User 테이블에서 추가 정보 가져오기
  const { data: userData } = await supabase
    .from('User')
    .select('name')
    .eq('UserID', user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    name: userData?.name || user.user_metadata?.name || '사용자',
  };
}

/**
 * 로그인이 필요한 페이지에서 사용
 * 로그인하지 않은 경우 로그인 페이지로 리다이렉트
 * @returns {Promise<Object>} 사용자 정보
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

/**
 * 세션이 유효한지 확인
 * @returns {Promise<boolean>} 세션 유효 여부
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return user !== null;
}
