import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: 문제의 댓글 목록 조회
export async function GET(request, { params }) {
  const supabase = await createClient();
  const { questionId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 댓글 목록 조회 (작성자 정보 포함)
    const { data: comments, error } = await supabase
      .from('comment')
      .select(`
        CommentId,
        Comment,
        TypeTime,
        UserID,
        User:UserID (
          name
        )
      `)
      .eq('QuestionID', questionId)
      .order('TypeTime', { ascending: true });

    if (error) {
      console.error('댓글 조회 오류:', error);
      return NextResponse.json({ error: '댓글을 불러올 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ comments });
  } catch (err) {
    console.error('댓글 조회 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

// POST: 댓글 추가
export async function POST(request, { params }) {
  const supabase = await createClient();
  const { questionId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // 요청 데이터 파싱
    const { comment } = await request.json();

    if (!comment || !comment.trim()) {
      return NextResponse.json({ error: '댓글 내용을 입력해주세요' }, { status: 400 });
    }

    // 댓글 추가
    const { data: newComment, error } = await supabase
      .from('comment')
      .insert({
        QuestionID: questionId,
        UserID: user.id,
        Comment: comment.trim(),
        TypeTime: new Date().toISOString(),
      })
      .select(`
        CommentId,
        Comment,
        TypeTime,
        UserID,
        User:UserID (
          name
        )
      `)
      .single();

    if (error) {
      console.error('댓글 추가 오류:', error);
      return NextResponse.json({ error: '댓글을 추가할 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error('댓글 추가 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

// DELETE: 댓글 삭제
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const { questionId } = await params;

  try {
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    // URL에서 commentId 파라미터 가져오기
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'commentId가 필요합니다' }, { status: 400 });
    }

    // 댓글 존재 및 작성자 확인
    const { data: comment } = await supabase
      .from('comment')
      .select('UserID, QuestionID')
      .eq('CommentId', commentId)
      .single();

    if (!comment) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 });
    }

    if (comment.QuestionID !== questionId) {
      return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }

    // 작성자 본인만 삭제 가능
    if (comment.UserID !== user.id) {
      return NextResponse.json({ error: '본인이 작성한 댓글만 삭제할 수 있습니다' }, { status: 403 });
    }

    // 댓글 삭제
    const { error } = await supabase
      .from('comment')
      .delete()
      .eq('CommentId', commentId);

    if (error) {
      console.error('댓글 삭제 오류:', error);
      return NextResponse.json({ error: '댓글을 삭제할 수 없습니다' }, { status: 500 });
    }

    return NextResponse.json({ message: '삭제되었습니다' });
  } catch (err) {
    console.error('댓글 삭제 오류:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
