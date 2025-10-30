// app/api/auth/logout/route.js
import { cookies } from 'next/headers';

export async function POST() {
  cookies().delete('auth-token');
  return Response.json({ success: true });
}