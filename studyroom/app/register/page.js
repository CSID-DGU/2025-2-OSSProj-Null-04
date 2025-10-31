// app/register/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
        return;
      }
      
      alert('회원가입 성공! 로그인 페이지로 이동합니다.');
      router.push('/login');
      
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-bg">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">회원가입</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-text-dark">이름</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-text-dark">이메일</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-text-dark">비밀번호</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
            />
            <p className="text-xs text-gray-text mt-1">최소 8자 이상 입력해주세요</p>
          </div>

          {error && (
            <div className="text-danger text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-2 rounded-md hover:bg-primary-hover disabled:bg-gray-400 transition-colors duration-200"
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-text">
          이미 계정이 있으신가요?{' '}
          <a href="/login" className="text-primary hover:underline">
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}