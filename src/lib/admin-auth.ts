// Admin session — stateless HMAC cookie. Edge-safe (Web Crypto only).
// Token = hex(HMAC-SHA256(SESSION_SECRET, "admin-v1")). Middleware
// recomputes and constant-time compares to the cookie. No DB hit.

export const ADMIN_COOKIE = 'sc_admin';
const TOKEN_PAYLOAD = 'admin-v1';

export async function computeAdminToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(TOKEN_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
