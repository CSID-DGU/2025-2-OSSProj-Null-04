import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcrypt';

// GET - 내 강의실 목록 조회 (owner/member 구분)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const supabase = createClient();

    // RoomMember 테이블에서 현재 사용자의 강의실 조회
    const { data: roomMembers, error: memberError } = await supabase
      .from('RoomMember')
      .select(`
        Role,
        Room (
          RoomID,
          RoomName,
          AdminID,
          EnterPin
        )
      `)
      .eq('UserID', user.id);

    if (memberError) {
      return Response.json({ error: memberError.message }, { status: 400 });
    }

    // owner와 member로 구분
    const owner = [];
    const member = [];

    roomMembers.forEach((rm) => {
      if (rm.Room) {
        if (rm.Role === 'owner') {
          owner.push(rm.Room);
        } else {
          member.push(rm.Room);
        }
      }
    });

    return Response.json({ owner, member }, { status: 200 });
  } catch (err) {
    console.error('강의실 목록 조회 오류:', err);
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

// 중복되지 않는 6자리 PIN 생성 함수
async function generateUniquePin(supabase) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // 6자리 랜덤 숫자 생성
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // 중복 확인
    const { data, error } = await supabase
      .from('Room')
      .select('EnterPin')
      .eq('EnterPin', pin)
      .single();

    // 중복되지 않으면 반환
    if (error || !data) {
      return pin;
    }

    attempts++;
  }

  throw new Error('PIN 생성 실패: 최대 시도 횟수 초과');
}

// POST - 강의실 생성
export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { roomName, roomPassword } = await request.json();

    // 필수 값 검증
    if (!roomName) {
      return Response.json({ error: '강의실 이름은 필수입니다' }, { status: 400 });
    }

    const supabase = createClient();

    // 중복되지 않는 PIN 자동 생성
    const enterPin = await generateUniquePin(supabase);

    // 비밀번호 해싱 (입력된 경우에만)
    let hashedPassword = null;
    if (roomPassword) {
      hashedPassword = await bcrypt.hash(roomPassword, 10);
    }

    // Room 테이블에 강의실 생성
    const { data: room, error: roomError } = await supabase
      .from('Room')
      .insert([{
        RoomName: roomName,
        AdminID: user.id,
        EnterPin: enterPin,
        RoomPassword: hashedPassword  // 해싱된 비밀번호 또는 NULL
      }])
      .select()
      .single();

    if (roomError) {
      return Response.json({ error: roomError.message }, { status: 400 });
    }

    // RoomMember 테이블에 owner로 추가
    const { error: memberError } = await supabase
      .from('RoomMember')
      .insert([{
        UserID: user.id,
        RoomID: room.RoomID,
        Role: 'owner'
      }]);

    if (memberError) {
      // Room 생성은 성공했지만 RoomMember 추가 실패 시, Room 삭제
      await supabase.from('Room').delete().eq('RoomID', room.RoomID);
      return Response.json({ error: memberError.message }, { status: 400 });
    }

    return Response.json({ room }, { status: 201 });
  } catch (err) {
    console.error('강의실 생성 오류:', err);
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
