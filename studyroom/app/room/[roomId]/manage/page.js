'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ManagePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params?.roomId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [actionLoading, setActionLoading] = useState(null); // 어떤 액션이 진행 중인지

  useEffect(() => {
    if (!roomId) return;
    fetchRoomData();
  }, [roomId]);

  const fetchRoomData = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/room/${roomId}/manage`, {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          // 권한이 없으면 파일 페이지로 리다이렉트
          router.push(`/room/${roomId}/file`);
          return;
        }
        throw new Error(data.error || '강의실 정보를 불러오지 못했습니다.');
      }

      setRoom(data.room);
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message || '강의실 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    if (!confirm(`해당 멤버의 권한을 "${newRole}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setActionLoading(`role-${targetUserId}`);

    try {
      const res = await fetch(`/api/room/${roomId}/manage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '권한 변경에 실패했습니다.');
      }

      alert('권한이 변경되었습니다.');
      fetchRoomData();
    } catch (err) {
      alert(err.message || '권한 변경 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleKickMember = async (targetUserId, userName) => {
    if (!confirm(`"${userName}" 멤버를 강퇴하시겠습니까?`)) {
      return;
    }

    setActionLoading(`kick-${targetUserId}`);

    try {
      const res = await fetch(`/api/room/${roomId}/manage?userId=${targetUserId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '멤버 강퇴에 실패했습니다.');
      }

      alert('멤버가 강퇴되었습니다.');
      fetchRoomData();
    } catch (err) {
      alert(err.message || '멤버 강퇴 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        강의실 관리
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        강의실 멤버의 권한을 관리하고 멤버를 강퇴할 수 있습니다.
      </p>

      {/* 강의실 정보 */}
      {room && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            강의실 정보
          </h3>
          <div className="space-y-1 text-sm">
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
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          멤버 목록 ({members.length}명)
        </h3>

        {members.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            멤버가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.UserID}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.User?.name || '알 수 없음'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      disabled={actionLoading === `role-${member.UserID}`}
                      className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600"
                    >
                      <option value="member">멤버</option>
                      <option value="guest">게스트</option>
                    </select>

                    {/* 강퇴 버튼 */}
                    <button
                      onClick={() => handleKickMember(member.UserID, member.User?.name)}
                      disabled={actionLoading === `kick-${member.UserID}`}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {actionLoading === `kick-${member.UserID}` ? '처리 중...' : '강퇴'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
