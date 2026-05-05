import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  void pathname
  void req
  const response = NextResponse.next()
  response.headers.set('x-crm-proxy-mode', 'pass-through')
  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

export default proxy
