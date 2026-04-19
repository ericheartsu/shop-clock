import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, computeAdminToken, timingSafeEqual } from '@/lib/admin-auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Operator PIN resolve stays open — needed for clock-in.
  if (pathname.startsWith('/api/operators/resolve')) {
    return NextResponse.next();
  }

  // Login page is open.
  if (pathname === '/admin/login') return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'SESSION_SECRET is not configured' },
      { status: 500 },
    );
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await computeAdminToken(secret);
  const authed = !!cookie && timingSafeEqual(cookie, expected);

  if (authed) return NextResponse.next();

  // API routes get JSON 401, pages get redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/operators/:path*'],
};
