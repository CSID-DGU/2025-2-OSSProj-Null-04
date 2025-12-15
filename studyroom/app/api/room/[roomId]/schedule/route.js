// app/api/room/[roomId]/schedule/route.js
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// 일정 조회 (GET)
export async function GET(request, { params }) {
  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. roomId 파라미터 추출
    const { roomId } = await params;

    // 3. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 4. 사용자가 해당 강의실의 멤버인지 확인
    const { data: membership, error: memberError } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (memberError || !membership) {
      return Response.json(
        { error: '해당 강의실에 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 5. 해당 강의실의 일정 조회
    const { data: schedules, error } = await supabase
      .from('Schedule')
      .select('*')
      .eq('RoomID', roomId)
      .order('EventDate', { ascending: true });

    if (error) {
      console.error('Schedule query error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      schedules: schedules || [],
    }, { status: 200 });

  } catch (err) {
    console.error('GET /api/room/[roomId]/schedule error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 일정 추가 (POST)
export async function POST(request, { params }) {
  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. roomId 파라미터 추출
    const { roomId } = await params;

    // 3. 요청 body 파싱
    const { eventTitle, eventDate } = await request.json();

    if (!eventTitle || !eventDate) {
      return Response.json(
        { error: '일정명과 날짜를 입력해주세요' },
        { status: 400 }
      );
    }

    // 4. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 5. 사용자가 해당 강의실의 멤버인지 확인 (권한 체크)
    const { data: membership, error: memberError } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (memberError || !membership) {
      return Response.json(
        { error: '해당 강의실에 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 게스트는 일정 추가 불가
    if (membership.Role === 'guest') {
      return Response.json(
        { error: '게스트는 일정을 추가할 수 없습니다' },
        { status: 403 }
      );
    }

    // 6. 일정 추가
    const { data: schedule, error } = await supabase
      .from('Schedule')
      .insert([{
        EventTitle: eventTitle,
        EventDate: eventDate,
        RoomID: roomId,
      }])
      .select()
      .single();

    if (error) {
      console.error('Schedule insert error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      message: '일정이 추가되었습니다',
      schedule,
    }, { status: 201 });

  } catch (err) {
    console.error('POST /api/room/[roomId]/schedule error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 일정 삭제 (DELETE)
export async function DELETE(request, { params }) {
  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    // 2. roomId 파라미터 추출
    const { roomId } = await params;

    // 3. 요청 body에서 eventId 추출
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return Response.json(
        { error: '삭제할 일정 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 4. Supabase 클라이언트 생성
    const supabase = await createClient();

    // 5. 사용자가 해당 강의실의 멤버인지 확인
    const { data: membership, error: memberError } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (memberError || !membership) {
      return Response.json(
        { error: '해당 강의실에 접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 게스트는 일정 삭제 불가
    if (membership.Role === 'guest') {
      return Response.json(
        { error: '게스트는 일정을 삭제할 수 없습니다' },
        { status: 403 }
      );
    }

    // 6. 일정 삭제
    const { error } = await supabase
      .from('Schedule')
      .delete()
      .eq('EventID', eventId)
      .eq('RoomID', roomId);

    if (error) {
      console.error('Schedule delete error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      message: '일정이 삭제되었습니다',
    }, { status: 200 });

  } catch (err) {
    console.error('DELETE /api/room/[roomId]/schedule error:', err);
    return Response.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}