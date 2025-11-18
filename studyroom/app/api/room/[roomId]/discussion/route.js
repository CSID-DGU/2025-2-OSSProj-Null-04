import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 강의실 토의 내역 조회
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { roomId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 강의실 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 멤버가 아닙니다' }, { status: 403 });
    }

    // 토의 내역 조회 (작성자 정보 포함)
    const { data: discussions, error } = await supabase
      .from('Discussion')
      .select(`
        DiscussionID,
        Content,
        CreatedAt,
        UserID,
        User:UserID (
          name
        )
      `)
      .eq('RoomID', roomId)
      .order('CreatedAt', { ascending: true });

    if (error) {
      console.error('토의 조회 오류:', error);
      return NextResponse.json({ error: '토의 내역을 불러올 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ discussions });
  } catch (err) {
    console.error('토의 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

// POST: 토의 댓글 추가
export async function POST(request, { params }) {
  const supabase = await createClient();
  const { roomId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 강의실 멤버십 확인
    const { data: membership } = await supabase
      .from('RoomMember')
      .select('*')
      .eq('RoomID', roomId)
      .eq('UserID', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '강의실 멤버가 아닙니다' }, { status: 403 });
    }

    // 요청 데이터 파싱
    const { content } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 });
    }

    // 토의 추가
    console.log('토의 추가 시도:', { RoomID: roomId, UserID: user.id, Content: content.trim() });

    const { data: discussion, error } = await supabase
      .from('Discussion')
      .insert({
        RoomID: roomId,
        UserID: user.id,
        Content: content.trim(),
      })
      .select(`
        DiscussionID,
        Content,
        CreatedAt,
        UserID,
        User:UserID (
          name
        )
      `)
      .single();

    if (error) {
      console.error('토의 추가 오류 상세:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      console.error('오류 세부사항:', error.details);
      return NextResponse.json({
        error: '토의를 추가할 수 없습니다',
        details: error.message,
        code: error.code
      }, { status: 500 });
    }

    return NextResponse.json({ discussion }, { status: 201 });
  } catch (err) {
    console.error('토의 추가 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

// DELETE: 토의 댓글 삭제
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { roomId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // URL에서 discussionId 파라미터 가져오기
    const { searchParams } = new URL(request.url);
    const discussionId = searchParams.get('discussionId');

    if (!discussionId) {
      return NextResponse.json({ error: 'discussionId가 필요합니다' }, { status: 400 });
    }

    // 토의 존재 및 작성자 확인
    const { data: discussion } = await supabase
      .from('Discussion')
      .select('UserID, RoomID')
      .eq('DiscussionID', discussionId)
      .single();

    if (!discussion) {
      return NextResponse.json({ error: '토의를 찾을 수 없습니다' }, { status: 404 });
    }

    if (discussion.RoomID !== roomId) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    // 작성자 본인만 삭제 가능
    if (discussion.UserID !== user.id) {
      return NextResponse.json({ error: '본인이 작성한 댓글만 삭제할 수 있습니다' }, { status: 403 });
    }

    // 토의 삭제
    const { error } = await supabase
      .from('Discussion')
      .delete()
      .eq('DiscussionID', discussionId);

    if (error) {
      console.error('토의 삭제 오류:', error);
      return NextResponse.json({ error: '토의를 삭제할 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ message: '삭제되었습니다' });
  } catch (err) {
    console.error('토의 삭제 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
