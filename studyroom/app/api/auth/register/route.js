import { supabase } from '@/lib/supabase/server';
import bcrypt from 'bcrypt';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();
    
    // 유효성 검사
    if (!email || !password || !name) {
      return Response.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      );
    }
    
    // 이메일 중복 확인
    const { data: existingUser } = await supabase
      .from('User')
      .select('UserID')
      .eq('UserInputID', email)
      .single();
    
    if (existingUser) {
      return Response.json(
        { error: '이미 사용 중인 이메일입니다' },
        { status: 409 }
      );
    }
    
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // DB에 저장
    const { data: newUser, error } = await supabase
      .from('User')
      .insert([{
        UserInputID: email,
        password: hashedPassword,
        name: name
      }])
      .select('UserID, name, UserInputID')
      .single();
    
    if (error) throw error;
    
    return Response.json({
      success: true,
      user: {
        id: newUser.UserID,
        name: newUser.name,
        email: newUser.UserInputID
      }
    });
    
  } catch (error) {
    console.error('Register error:', error);
    return Response.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}