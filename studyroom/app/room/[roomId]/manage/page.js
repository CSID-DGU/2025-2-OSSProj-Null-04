'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function ManagePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId;
  const queryClient = useQueryClient();

  // 강의실 정보 조회 (useQuery)
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['roomManage', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/room/${roomId}/manage`, {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          router.push(`/room/${roomId}/file`);
          throw new Error('Forbidden');
        }
        throw new Error(data.error || '강의실 정보를 불러오지 못했습니다.');
      }

      return data;
    },
    enabled: !!roomId,
    staleTime: 60 * 1000, // 1분
  });

  const room = data?.room;
  const members = data?.members || [];

  // 권한 변경 mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, newRole }) => {
      const res = await fetch(`/api/room/${roomId}/manage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '권한 변경에 실패했습니다.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['roomManage', roomId]);
      alert('권한이 변경되었습니다.');
    },
    onError: (err) => {
      alert(err.message || '권한 변경 중 오류가 발생했습니다.');
    },
  });

  // 멤버 강퇴 mutation
  const kickMemberMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const res = await fetch(`/api/room/${roomId}/manage?userId=${targetUserId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '멤버 강퇴에 실패했습니다.');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['roomManage', roomId]);
      alert('멤버가 강퇴되었습니다.');
    },
    onError: (err) => {
      alert(err.message || '멤버 강퇴 중 오류가 발생했습니다.');
    },
  });

  const handleRoleChange = (targetUserId, newRole) => {
    if (!confirm(`해당 멤버의 권한을 "${newRole}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    changeRoleMutation.mutate({ targetUserId, newRole });
  };

  const handleKickMember = (targetUserId, userName) => {
    if (!confirm(`"${userName}" 멤버를 강퇴하시겠습니까?`)) {
      return;
    }

    kickMemberMutation.mutate(targetUserId);
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'owner':
        return '방장';
      case 'member':
        return '멤버';
      case 'guest':
        return '게스트';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'guest':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          강의실 관리
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          강의실 멤버의 권한을 관리하고 멤버를 강퇴할 수 있어요.
        </p>
      </div>

      {/* 강의실 정보 */}
      {room && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            강의실 정보
          </h3>
          <div className="space-y-2 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">강의실 이름:</span> {room.RoomName}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">참여 코드:</span>{' '}
              <span className="font-mono">{room.EnterPin}</span>
            </p>
          </div>
        </div>
      )}

      {/* 멤버 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          멤버 목록 ({members.length}명)
        </h3>

        {members.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-4">
            멤버가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <li
                key={member.UserID}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.User?.name || '알 수 없음'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {member.User?.UserInputID || ''}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                      member.Role
                    )}`}
                  >
                    {getRoleLabel(member.Role)}
                  </span>
                </div>

                {/* 방장이 아닌 멤버에게만 액션 버튼 표시 */}
                {member.Role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    {/* 권한 변경 드롭다운 */}
                    <select
                      value={member.Role}
                      onChange={(e) => handleRoleChange(member.UserID, e.target.value)}
                      disabled={changeRoleMutation.isPending}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600"
                    >
                      <option value="member">멤버</option>
                      <option value="guest">게스트</option>
                    </select>

                    {/* 강퇴 버튼 */}
                    <button
                      onClick={() => handleKickMember(member.UserID, member.User?.name)}
                      disabled={kickMemberMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors text-sm font-medium disabled:opacity-60"
                    >
                      {kickMemberMutation.isPending ? '처리 중...' : '강퇴'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
