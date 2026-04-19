import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, computeAdminToken } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!expected || !secret) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD or SESSION_SECRET is not configured' },
      { status: 500 },
    );
  }
  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await computeAdminToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
