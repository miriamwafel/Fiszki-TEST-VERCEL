export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sets/:path*',
    '/stories/:path*',
    '/exercises/:path*',
    '/notes/:path*',
  ],
}
