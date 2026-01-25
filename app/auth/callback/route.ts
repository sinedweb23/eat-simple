import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

/**
 * Rota de callback do Supabase Auth
 * Esta rota intercepta o redirecionamento do Supabase após verificar o token
 * GET /auth/callback?code=...&type=recovery
 * OU
 * GET /auth/callback?token=...&type=recovery (quando Supabase redireciona diretamente)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log('🔍 Callback recebido:', { code: code ? 'existe' : 'não existe', token: token ? 'existe' : 'não existe', type, error })

  // Se houver erro, redirecionar para login com mensagem
  if (error) {
    console.error('❌ Erro no callback do Supabase:', error, errorDescription)
    return redirect(`/login?error=${encodeURIComponent(errorDescription || error)}`)
  }

  const supabase = await createClient()

  // Se houver código, trocar por sessão (fluxo padrão do Supabase)
  if (code) {
    console.log('🔄 Trocando código por sessão...')
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('❌ Erro ao trocar código por sessão:', exchangeError)
      return redirect(`/primeiro-acesso?error=${encodeURIComponent(exchangeError.message)}`)
    }

    if (!session) {
      console.error('❌ Sessão não criada após trocar código')
      return redirect('/primeiro-acesso?error=erro_ao_criar_sessao')
    }

    console.log('✅ Sessão criada com sucesso via código')
    
    // Se for recovery, redirecionar para página de reset de senha
    if (type === 'recovery') {
      return redirect('/auth/reset-password')
    }

    // Para outros tipos, redirecionar para login
    return redirect('/login')
  }

  // Verificar se já há sessão ativa (token pode ter sido processado pelo Supabase antes do redirect)
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    console.log('✅ Sessão já existe, redirecionando para reset de senha')
    if (type === 'recovery') {
      return redirect('/auth/reset-password')
    }
    return redirect('/login')
  }

  // Se não houver código mas houver token, processar token diretamente
  if (token && type === 'recovery') {
    console.log('🔄 Processando token diretamente...')
    
    try {
      // Tentar verificar o token diretamente
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      })

      if (verifyError) {
        console.error('❌ Erro ao verificar token:', verifyError)
        return redirect('/primeiro-acesso?error=token_invalido_ou_expirado')
      }

      if (verifyData?.session) {
        console.log('✅ Token verificado e sessão criada, redirecionando para reset de senha')
        return redirect('/auth/reset-password')
      }

      // Se não criou sessão, verificar novamente
      const { data: { session: newSession } } = await supabase.auth.getSession()
      if (newSession) {
        console.log('✅ Sessão criada após verificação, redirecionando para reset de senha')
        return redirect('/auth/reset-password')
      }

      console.error('❌ Token verificado mas sessão não foi criada')
      return redirect('/primeiro-acesso?error=erro_ao_criar_sessao')
    } catch (err: any) {
      console.error('❌ Erro ao processar token:', err)
      return redirect(`/primeiro-acesso?error=${encodeURIComponent(err.message || 'erro_ao_processar_token')}`)
    }
  }

  // Se não houver código nem token, o Supabase pode ter processado o token
  // e redirecionado sem passar código/token na URL
  // Neste caso, redirecionar para reset de senha que verifica a sessão e processa hash
  // A página de reset é client-side e pode processar o hash da URL
  console.log('🔄 Sem código/token no callback, redirecionando para reset de senha (processará hash se houver)')
  return redirect('/auth/reset-password')
}
