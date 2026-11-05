import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getSupabaseConfig } from './config'

const PUBLIC_PATHS = ['/login']

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request) {
  const { url, key, configured } = getSupabaseConfig()
  const { pathname } = request.nextUrl

  if (!configured) {
    if (isPublicPath(pathname)) return NextResponse.next({ request })
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v))
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)

  if (pathname.startsWith('/api/')) {
    return response
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
    return redirectWithCookies(loginUrl, response)
  }

  if (isAuthenticated && isPublicPath(pathname)) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return redirectWithCookies(dashboardUrl, response)
  }

  return response
}

function redirectWithCookies(target, source) {
  const redirect = NextResponse.redirect(target)
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}
