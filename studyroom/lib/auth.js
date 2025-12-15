import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * 현재 로그인한 사용자 정보를 가져옵니다
 * @returns {Promise<Object|null>} 사용자 정보 또는 null
 */
export async function getCurrentUser() {
  const supabase = await createClient();

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
/**
 * 특정 강의실의 멤버인지 확인
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object|null>} 멤버십 정보 또는 null
 */
export async function checkRoomMembership(roomId, userId) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('checkRoomMembership error:', err);
    return null;
  }
}

/**
 * 강의실 소유자인지 확인
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>}
 */
export async function isRoomOwner(roomId, userId) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('Room')
      .select('AdminID')
      .eq('RoomID', roomId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.AdminID === userId;
  } catch (err) {
    console.error('isRoomOwner error:', err);
    return false;
  }
}

/**
 * 강의실 편집 권한 확인 (owner 또는 editor)
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>}
 */
export async function canEditRoom(roomId, userId) {
  try {
    // 소유자인 경우
    if (await isRoomOwner(roomId, userId)) {
      return true;
    }

    // 편집 권한이 있는 경우
    const membership = await checkRoomMembership(roomId, userId);
    if (membership && (membership.Role === 'owner' || membership.Role === 'editor')) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('canEditRoom error:', err);
    return false;
  }
}

/**
 * 강의실 멤버인지 확인 (guest 포함)
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>}
 */
export async function isRoomMember(roomId, userId) {
  try {
    const membership = await checkRoomMembership(roomId, userId);
    return membership !== null;
  } catch (err) {
    console.error('isRoomMember error:', err);
    return false;
  }
}

/**
 * 게스트가 아닌지 확인 (member 이상)
 * 파일 업로드, 퀴즈 생성, 일정 추가 등의 권한 확인
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>}
 */
export async function canModifyRoom(roomId, userId) {
  try {
    const membership = await checkRoomMembership(roomId, userId);
    if (!membership) {
      return false;
    }

    // guest가 아닌 경우 (owner, member)
    return membership.Role !== 'guest';
  } catch (err) {
    console.error('canModifyRoom error:', err);
    return false;
  }
}

/**
 * 사용자의 강의실 역할 가져오기
 * @param {string} roomId - 강의실 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string|null>} 'owner', 'member', 'guest' 또는 null
 */
export async function getRoomRole(roomId, userId) {
  try {
    const membership = await checkRoomMembership(roomId, userId);
    return membership ? membership.Role : null;
  } catch (err) {
    console.error('getRoomRole error:', err);
    return null;
  }
}