import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Criar nova resposta para atualizar cookies
          supabaseResponse = NextResponse.next({
            request,
          })
          // Aplicar todos os cookies na resposta
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANTE: Atualizar a sessão do usuário
  // Primeiro verificar a sessão
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log('[Middleware] Path:', request.nextUrl.pathname, 'Session:', session ? 'existe' : 'não existe', sessionError?.message)
  
  // Depois obter o usuário
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[Middleware] User:', user ? user.id : 'não autenticado', userError?.message)

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * Note: Server actions are POST requests to the same route, so they will be caught by this matcher
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
