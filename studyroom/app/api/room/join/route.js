import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcrypt';

// POST - 강의실 찾기 및 참여
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { enterPin, roomPassword } = await request.json();

    // PIN 검증
    if (!enterPin || !/^\d{6}$/.test(enterPin)) {
      return Response.json({ error: '올바른 PIN을 입력해주세요 (6자리 숫자)' }, { status: 400 });
    }

    const supabase = await createClient();

    // Step 1: PIN으로 강의실 검색
    const { data: room, error: roomError } = await supabase
      .from('Room')
      .select('*')
      .eq('EnterPin', enterPin)
      .single();

    if (roomError || !room) {
      return Response.json({ error: 'PIN에 해당하는 강의실을 찾을 수 없습니다' }, { status: 404 });
    }

    // Step 2: 비밀번호 확인 (RoomPassword가 NULL이 아닌 경우)
    if (room.RoomPassword) {
      if (!roomPassword) {
        // 비밀번호가 필요한 강의실인데 입력하지 않음
        return Response.json({
          needPassword: true,
          room: { RoomID: room.RoomID, RoomName: room.RoomName }
        }, { status: 200 });
      }

      // bcrypt로 비밀번호 비교
      const isPasswordValid = await bcrypt.compare(roomPassword, room.RoomPassword);
      if (!isPasswordValid) {
        return Response.json({ error: '비밀번호가 일치하지 않습니다' }, { status: 403 });
      }
    }

    // Step 3: 이미 참여 중인지 확인
    const { data: existing, error: existError } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('UserID', user.id)
      .eq('RoomID', room.RoomID)
      .single();

    if (existing) {
      return Response.json({ error: '이미 참여 중인 강의실입니다', room }, { status: 200 });
    }

    // Step 4: RoomMember 테이블에 member로 추가
    const { error: joinError } = await supabase
      .from('RoomMember')
      .insert([{
        UserID: user.id,
        RoomID: room.RoomID,
        Role: 'member'
      }]);

    if (joinError) {
      return Response.json({ error: joinError.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: '강의실에 참여했습니다',
      room: { RoomID: room.RoomID, RoomName: room.RoomName }
    }, { status: 201 });
  } catch (err) {
    console.error('강의실 참여 오류:', err);
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
