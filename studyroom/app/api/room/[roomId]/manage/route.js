import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// GET /api/room/[roomId]/manage - 강의실 멤버 목록 조회 (owner만 가능)
export async function GET(request, context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { params } = await context;
    const { roomId } = params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // owner 권한 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership || membership.Role !== 'owner') {
      return NextResponse.json(
        { error: '강의실 관리 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 강의실 정보 조회
    const { data: room, error: roomError } = await supabase
      .from('Room')
      .select('RoomID, RoomName, EnterPin, AdminID')
      .eq('RoomID', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: '강의실을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 멤버 목록 조회
    const { data: members, error: membersError } = await supabase
      .from('RoomMember')
      .select(`
        UserID,
        Role,
        User:UserID (
          name,
          UserInputID
        )
      `)
      .eq('RoomID', roomId)
      .order('Role', { ascending: true });

    if (membersError) {
      console.error('멤버 목록 조회 실패:', membersError);
      return NextResponse.json(
        { error: '멤버 목록을 불러오지 못했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      room,
      members: members || [],
    });
  } catch (error) {
    console.error('강의실 관리 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// PUT /api/room/[roomId]/manage - 멤버 권한 변경 (owner만 가능)
export async function PUT(request, context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { params } = await context;
    const { roomId } = params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const { targetUserId, newRole } = await request.json();

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: '대상 사용자와 역할이 필요합니다' },
        { status: 400 }
      );
    }

    if (!['member', 'guest'].includes(newRole)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // owner 권한 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership || membership.Role !== 'owner') {
      return NextResponse.json(
        { error: '강의실 관리 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 대상 멤버가 owner인지 확인 (owner는 권한 변경 불가)
    const { data: targetMember } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', targetUserId)
      .eq('RoomID', roomId)
      .single();

    if (targetMember?.Role === 'owner') {
      return NextResponse.json(
        { error: '방장의 권한은 변경할 수 없습니다' },
        { status: 403 }
      );
    }

    // 권한 변경
    const { error: updateError } = await supabase
      .from('RoomMember')
      .update({ Role: newRole })
      .eq('UserID', targetUserId)
      .eq('RoomID', roomId);

    if (updateError) {
      console.error('권한 변경 실패:', updateError);
      return NextResponse.json(
        { error: '권한 변경에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '권한이 변경되었습니다',
    });
  } catch (error) {
    console.error('권한 변경 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// DELETE /api/room/[roomId]/manage - 멤버 강퇴 (owner만 가능)
export async function DELETE(request, context) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다' },
        { status: 401 }
      );
    }

    const { params } = await context;
    const { roomId } = params ?? {};
    if (!roomId) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: '대상 사용자가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // owner 권한 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', user.id)
      .eq('RoomID', roomId)
      .single();

    if (!membership || membership.Role !== 'owner') {
      return NextResponse.json(
        { error: '강의실 관리 권한이 없습니다' },
        { status: 403 }
      );
    }

    // 대상 멤버가 owner인지 확인 (owner는 강퇴 불가)
    const { data: targetMember } = await supabase
      .from('RoomMember')
      .select('Role')
      .eq('UserID', targetUserId)
      .eq('RoomID', roomId)
      .single();

    if (targetMember?.Role === 'owner') {
      return NextResponse.json(
        { error: '방장은 강퇴할 수 없습니다' },
        { status: 403 }
      );
    }

    // 자기 자신 강퇴 방지
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: '자기 자신은 강퇴할 수 없습니다' },
        { status: 403 }
      );
    }

    // 멤버 삭제
    const { error: deleteError } = await supabase
      .from('RoomMember')
      .delete()
      .eq('UserID', targetUserId)
      .eq('RoomID', roomId);

    if (deleteError) {
      console.error('멤버 삭제 실패:', deleteError);
      return NextResponse.json(
        { error: '멤버 강퇴에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '멤버가 강퇴되었습니다',
    });
  } catch (error) {
    console.error('멤버 강퇴 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
