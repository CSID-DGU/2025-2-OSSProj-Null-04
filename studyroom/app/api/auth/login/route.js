// app/api/auth/login/route.js
import { supabase } from '@/lib/supabase/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    // 사용자 찾기
    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('UserInputID', email)
      .single();
    
    if (error || !user) {
      return Response.json(
        { error: '이메일 또는 비밀번호가 틀렸습니다' },
        { status: 401 }
      );
    }
    
    // 비밀번호 확인
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return Response.json(
        { error: '이메일 또는 비밀번호가 틀렸습니다' },
        { status: 401 }
      );
    }
    
    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: user.UserID,
        name: user.name,
        email: user.UserInputID
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // 쿠키에 저장
    cookies().set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7  // 7일
    });
    
    return Response.json({
      success: true,
      user: {
        id: user.UserID,
        name: user.name,
        email: user.UserInputID
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return Response.json(
      { error: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}