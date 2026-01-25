'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { temFilhosAtivos } from '@/app/actions/responsavel'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showEscolhaModal, setShowEscolhaModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Verificar se há mensagem de sucesso na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlMessage = urlParams.get('message')
    if (urlMessage === 'senha_criada' || urlMessage === 'senha_atualizada') {
      setMessage('Senha criada/atualizada com sucesso! Faça login com sua nova senha.')
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validação básica
    if (!email || !email.trim()) {
      setError('Por favor, informe o email')
      setLoading(false)
      return
    }

    if (!password || !password.trim()) {
      setError('Por favor, informe a senha')
      setLoading(false)
      return
    }

    try {
      console.log('Tentando fazer login com email:', email)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (authError) {
        console.error('Erro de autenticação:', authError)
        throw new Error(authError.message || 'Credenciais inválidas')
      }

      if (!authData.user) {
        throw new Error('Falha ao fazer login')
      }

      console.log('Login bem-sucedido, usuário:', authData.user.id)
      
      // Aguardar um pouco para garantir que os cookies sejam salvos
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Verificar a sessão
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Sessão final após login:', session ? 'existe' : 'não existe', sessionError)
      
      if (!session) {
        throw new Error('Sessão não estabelecida após login')
      }

      // Verificar se é admin ou responsável
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuário não encontrado na sessão')
      }

      // Buscar usuário na tabela usuarios
      console.log('[Login] Buscando usuário com auth_user_id:', user.id)
      const { data: usuario, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, eh_admin, ativo, super_admin, nome, email_financeiro')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      console.log('[Login] Resultado da busca:', { usuario, usuarioError })

      if (usuarioError) {
        console.error('[Login] Erro completo ao buscar usuário:', {
          message: usuarioError.message,
          details: usuarioError.details,
          hint: usuarioError.hint,
          code: usuarioError.code
        })
        throw new Error(`Erro ao verificar permissões: ${usuarioError.message || 'Erro desconhecido'}`)
      }

      if (!usuario) {
        console.error('[Login] Usuário não encontrado na tabela usuarios para auth_user_id:', user.id)
        throw new Error('Usuário não encontrado no sistema. Entre em contato com o suporte.')
      }

      console.log('[Login] Usuário encontrado:', {
        id: usuario.id,
        nome: usuario.nome,
        eh_admin: usuario.eh_admin,
        super_admin: usuario.super_admin,
        ativo: usuario.ativo
      })

      if (!usuario.ativo) {
        throw new Error('Sua conta está inativa. Entre em contato com a administração.')
      }

      const ehAdmin = usuario.eh_admin === true
      
      // Verificar se tem filhos ativos
      const temFilhos = await temFilhosAtivos()
      
      console.log('[Login] Verificações:', { ehAdmin, temFilhos })

      // Lógica de redirecionamento:
      // 1. Se é admin E tem filhos → mostrar modal de escolha
      // 2. Se é apenas responsável (tem filhos, não é admin) → ir para loja
      // 3. Se é apenas admin (não tem filhos) → ir para admin

      if (ehAdmin && temFilhos) {
        // Admin com filhos → mostrar modal de escolha
        console.log('Usuário é admin e tem filhos, mostrando modal de escolha')
        setShowEscolhaModal(true)
        setLoading(false)
      } else if (temFilhos && !ehAdmin) {
        // Apenas responsável (tem filhos, não é admin) → ir para loja
        console.log('Redirecionando para /loja (apenas responsável)')
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = '/loja'
      } else if (ehAdmin && !temFilhos) {
        // Apenas admin (não tem filhos) → ir para admin
        console.log('Redirecionando para /admin (apenas admin)')
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = '/admin'
      } else {
        // Caso não esperado
        throw new Error('Usuário sem permissões ou filhos vinculados')
      }
    } catch (err) {
      console.error('Erro completo:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao fazer login'
      setError(errorMessage)
      setLoading(false)
    }
  }

  function escolherModo(modo: 'admin' | 'loja') {
    setShowEscolhaModal(false)
    if (modo === 'admin') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/loja'
    }
  }

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Faça login para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded-md text-sm mb-4">
              {message}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
                disabled={loading}
              />
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link 
              href="/primeiro-acesso" 
              className="text-sm text-muted-foreground hover:underline"
            >
              Primeiro acesso? Solicite criação de senha
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Escolha (Admin com Filhos) */}
      <Dialog open={showEscolhaModal} onOpenChange={setShowEscolhaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolher Modo de Acesso</DialogTitle>
            <DialogDescription>
              Você pode acessar como administrador ou como responsável. Escolha como deseja continuar:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              onClick={() => escolherModo('admin')}
              className="h-auto py-6 flex flex-col items-start"
              size="lg"
            >
              <span className="text-lg font-semibold mb-1">👨‍💼 Entrar como Admin</span>
              <span className="text-sm font-normal opacity-90">
                Acesse o painel administrativo para gerenciar pedidos, produtos, empresas e mais
              </span>
            </Button>
            <Button
              onClick={() => escolherModo('loja')}
              variant="outline"
              className="h-auto py-6 flex flex-col items-start"
              size="lg"
            >
              <span className="text-lg font-semibold mb-1">🛍️ Acessar a Loja</span>
              <span className="text-sm font-normal opacity-90">
                Acesse a loja para comprar produtos e serviços para seus filhos
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
