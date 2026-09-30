import { NextRequest, NextResponse } from 'next/server';

/**
 * Backup files are kept in public/backup for compatibility with the existing
 * persistent Docker volume. Rewrite requests before Next's public-file handler
 * so the authenticated route can enforce administrator access.
 */
export function proxy(request: NextRequest) {
  const target = request.nextUrl.clone();
  const suffix = request.nextUrl.pathname.replace(/^\/backup(?:\/|$)/, '');
  target.pathname = suffix
    ? `/api/secure-backup/${suffix}`
    : '/api/secure-backup';
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ['/backup/:path*'],
};
